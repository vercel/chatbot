//! Thin Firestore REST client: document GET/PATCH/DELETE and
//! `documents:runQuery`.
//!
//! Error mapping: transport failures → [`Error::Unavailable`] (retryable);
//! non-2xx responses → [`Error::Storage`] (except GET 404 → `None` and
//! precondition failures → [`Error::NotFound`] where requested).

use reqwest::{RequestBuilder, Response, StatusCode};
use rustra_core::{Error, Result};
use serde_json::Value;

use crate::{AuthMode, FirebaseConfig};

const DEFAULT_BASE_URL: &str = "https://firestore.googleapis.com/v1";

pub(crate) struct RestClient {
    http: reqwest::Client,
    auth: AuthMode,
    /// API base, e.g. `https://firestore.googleapis.com/v1` (no trailing `/`).
    base_url: String,
    /// `projects/<p>/databases/(default)/documents` (no leading/trailing `/`).
    documents_path: String,
}

impl RestClient {
    pub(crate) fn new(config: FirebaseConfig) -> Self {
        let base_url = config
            .base_url
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_owned())
            .trim_end_matches('/')
            .to_owned();
        let documents_path = format!(
            "projects/{}/databases/(default)/documents",
            config.project_id
        );
        Self {
            http: reqwest::Client::new(),
            auth: config.auth,
            base_url,
            documents_path,
        }
    }

    /// Build a document URL, enforcing the crate contract that record ids
    /// contain no `/` (Firestore path separator). `?` and `#` are also
    /// rejected: they would be parsed as URL query/fragment delimiters, and
    /// `..` path segments containing `/` are normalized away by the URL
    /// parser, retargeting the request at a different collection.
    fn doc_url(&self, collection: &str, id: &str) -> Result<String> {
        if id.is_empty() || id.contains(['/', '?', '#']) {
            return Err(Error::Storage(format!(
                "firestore document id `{id}` is invalid: ids must be non-empty and must not contain `/`, `?`, or `#`"
            )));
        }
        Ok(format!(
            "{}/{}/{}/{}",
            self.base_url, self.documents_path, collection, id
        ))
    }

    fn with_auth(&self, req: RequestBuilder) -> RequestBuilder {
        match &self.auth {
            AuthMode::ApiKey(key) => req.query(&[("key", key.as_str())]),
            AuthMode::BearerToken(token) => req.bearer_auth(token),
        }
    }

    fn transport_err(e: reqwest::Error) -> Error {
        Error::Unavailable(format!("firestore request failed: {e}"))
    }

    async fn check(resp: Response, context: &str) -> Result<Response> {
        let status = resp.status();
        if status.is_success() {
            return Ok(resp);
        }
        let body = resp.text().await.unwrap_or_default();
        Err(Error::Storage(format!(
            "firestore {context} returned {status}: {body}"
        )))
    }

    async fn json_body(resp: Response, context: &str) -> Result<Value> {
        resp.json()
            .await
            .map_err(|e| Error::Storage(format!("firestore {context}: invalid response body: {e}")))
    }

    /// GET one document; `Ok(None)` when it does not exist.
    pub(crate) async fn get_document(&self, collection: &str, id: &str) -> Result<Option<Value>> {
        let resp = self
            .with_auth(self.http.get(self.doc_url(collection, id)?))
            .send()
            .await
            .map_err(Self::transport_err)?;
        if resp.status() == StatusCode::NOT_FOUND {
            return Ok(None);
        }
        let resp = Self::check(resp, "get").await?;
        Ok(Some(Self::json_body(resp, "get").await?))
    }

    /// PATCH (create-or-replace) a document body (`{"fields": {...}}`).
    pub(crate) async fn patch_document(
        &self,
        collection: &str,
        id: &str,
        doc: Value,
    ) -> Result<()> {
        let resp = self
            .with_auth(self.http.patch(self.doc_url(collection, id)?))
            .json(&doc)
            .send()
            .await
            .map_err(Self::transport_err)?;
        Self::check(resp, "patch").await?;
        Ok(())
    }

    /// PATCH with the `currentDocument.exists=true` precondition; missing
    /// documents map to [`Error::NotFound`] with the given `entity` kind.
    pub(crate) async fn update_existing_document(
        &self,
        collection: &str,
        id: &str,
        doc: Value,
        entity: &'static str,
    ) -> Result<()> {
        let resp = self
            .with_auth(
                self.http
                    .patch(self.doc_url(collection, id)?)
                    .query(&[("currentDocument.exists", "true")]),
            )
            .json(&doc)
            .send()
            .await
            .map_err(Self::transport_err)?;
        if matches!(
            resp.status(),
            StatusCode::NOT_FOUND | StatusCode::CONFLICT | StatusCode::PRECONDITION_FAILED
        ) {
            return Err(Error::not_found(entity, id));
        }
        Self::check(resp, "patch").await?;
        Ok(())
    }

    /// DELETE a document (idempotent: deleting a missing document succeeds,
    /// matching the reference backends).
    pub(crate) async fn delete_document(&self, collection: &str, id: &str) -> Result<()> {
        let resp = self
            .with_auth(self.http.delete(self.doc_url(collection, id)?))
            .send()
            .await
            .map_err(Self::transport_err)?;
        if resp.status() == StatusCode::NOT_FOUND {
            return Ok(());
        }
        Self::check(resp, "delete").await?;
        Ok(())
    }

    /// DELETE a document addressed by its full resource name.
    pub(crate) async fn delete_document_by_name(&self, name: &str) -> Result<()> {
        let resp = self
            .with_auth(self.http.delete(format!("{}/{}", self.base_url, name)))
            .send()
            .await
            .map_err(Self::transport_err)?;
        if resp.status() == StatusCode::NOT_FOUND {
            return Ok(());
        }
        Self::check(resp, "delete").await?;
        Ok(())
    }

    /// POST `documents:runQuery` and return the matched documents (each a
    /// `{"name": ..., "fields": {...}}` object, in result order). Result
    /// entries without a `document` key (e.g. trailing read-time markers)
    /// are skipped.
    pub(crate) async fn run_query(&self, body: Value) -> Result<Vec<Value>> {
        let url = format!("{}/{}:runQuery", self.base_url, self.documents_path);
        let resp = self
            .with_auth(self.http.post(url))
            .json(&body)
            .send()
            .await
            .map_err(Self::transport_err)?;
        let resp = Self::check(resp, "runQuery").await?;
        let entries = match Self::json_body(resp, "runQuery").await? {
            Value::Array(entries) => entries,
            other => {
                return Err(Error::Storage(format!(
                    "firestore runQuery: expected array, got {other}"
                )))
            }
        };
        Ok(entries
            .into_iter()
            .filter_map(|mut entry| entry.get_mut("document").map(Value::take))
            .collect())
    }
}
