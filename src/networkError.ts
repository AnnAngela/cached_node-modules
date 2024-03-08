const npmNetworkError = [
    "ECONNREFUSED",
    "ECONNRESET",
    "ENOTFOUND",
    "EPIPE",
    "ETIMEDOUT",
].map((errorCode) => `npm ERR! code ${errorCode}`);

export default [
    ...npmNetworkError,
];
