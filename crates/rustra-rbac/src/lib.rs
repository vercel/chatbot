//! # rustra-rbac
//!
//! Access control for every governable resource, combining the
//! industry-standard layers (in evaluation order):
//!
//! 1. **System principal** — internal supervisors bypass checks.
//! 2. **Admin role** — admins bypass all further checks.
//! 3. **Ownership** — full control over what you own, provided the role matrix
//!    allows the `(kind, action)` at all. Default roles: `builder`,
//!    `developer`, `admin`; the matrix is extensible with custom roles.
//! 4. **Visibility** — `public` artifacts allow read and execute, `shared`
//!    artifacts allow read, again gated by the role matrix.
//! 5. **ACLs** — explicit sharing grants on individual resources (to a user
//!    or to a role). Grants are additive and NOT gated by the role matrix;
//!    they are the only way `private` resources cross user boundaries.
//! 6. **Default deny** — least privilege.
//!
//! Mastra models auth as a pluggable provider (`authenticateToken` /
//! `authorizeUser`) plus fine-grained authorization; [`AuthProvider`] mirrors
//! the former, [`AccessControl`] implements the latter over the storage ACL
//! domain.

mod access;
mod auth;
mod policy;
mod sha256;

pub use access::{role_grantee, AccessControl, Governed, ROLE_GRANTEE_PREFIX};
pub use auth::{AuthProvider, TokenAuthProvider};
pub use policy::{Permission, RolePolicy};
