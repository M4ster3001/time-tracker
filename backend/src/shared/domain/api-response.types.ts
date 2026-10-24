export interface IApiErrorField {
  field: string;
  message: string;
}

export interface IApiErrorDetails {
  requestId?: string;
  fieldErrors?: IApiErrorField[];
  code?: string;
  source?: 'body' | 'query' | 'params';
}

export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: IApiErrorDetails;
}
