const API_RESULT_OK_PATTERN = /^0+$/;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function isOrcaApiResultOk(apiResult?: string): boolean {
  return Boolean(apiResult && API_RESULT_OK_PATTERN.test(apiResult));
}
