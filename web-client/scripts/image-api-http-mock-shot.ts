import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const baseUrl = 'http://localhost';
const server = setupServer(
  http.get(`${baseUrl}/karte/images`, () =>
    HttpResponse.json({ list: [], page: 1, total: 0 }, { status: 200 }),
  ),
  http.get(`${baseUrl}/karte/image/:id`, ({ params }) =>
    HttpResponse.json({ id: Number(params.id), title: 'mock-image' }, { status: 200 }),
  ),
  http.get(`${baseUrl}/karte/attachment/:id`, ({ params }) =>
    HttpResponse.json({ id: Number(params.id), title: 'mock-attachment' }, { status: 200 }),
  ),
  http.post(`${baseUrl}/api/charts/document-drafts`, () =>
    HttpResponse.json({ ok: true, docPk: 9024, receivedAttachments: 1 }, { status: 200 }),
  ),
);

const main = async () => {
  server.listen({ onUnhandledRequest: 'warn' });

  const responses = [] as Array<{ url: string; status: number; body: string }>;
  const listRes = await fetch(`${baseUrl}/karte/images`);
  responses.push({ url: listRes.url, status: listRes.status, body: await listRes.text() });

  const detailRes = await fetch(`${baseUrl}/karte/image/901`);
  responses.push({ url: detailRes.url, status: detailRes.status, body: await detailRes.text() });

  const attachmentRes = await fetch(`${baseUrl}/karte/attachment/777`);
  responses.push({ url: attachmentRes.url, status: attachmentRes.status, body: await attachmentRes.text() });

  const docRes = await fetch(`${baseUrl}/api/charts/document-drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attachment: [{ fileName: 'mock.png' }] }),
  });
  responses.push({ url: docRes.url, status: docRes.status, body: await docRes.text() });

  responses.forEach((entry) => {
    console.info('[mock-response]', entry);
  });

  server.close();
};

main().catch((error) => {
  console.error('[mock-response] failed', error);
  server.close();
  process.exit(1);
});
