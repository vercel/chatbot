export type SharedThreadId = string;

export interface SharedPrincipal {
  googleSub: string;
  email: string;
  hd?: string;
}

export interface SharedHealthResponse {
  status: 'ok' | 'ready';
}
