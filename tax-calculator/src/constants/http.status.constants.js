// An API Extension's HTTP destination must respond with exactly 200 or 201
// for a successful response (with or without update actions) - 202 is
// rejected by commercetools with ExtensionBadResponse, even though it's a
// generically reasonable "accepted" status for other kinds of APIs.
export const HTTP_STATUS_OK = 200;

export const HTTP_STATUS_BAD_REQUEST = 400;

export const HTTP_STATUS_UNAUTHORIZED = 401;

export const HTTP_STATUS_SERVER_ERROR = 500;
