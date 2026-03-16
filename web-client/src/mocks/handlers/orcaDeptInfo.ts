import { http, HttpResponse } from 'msw';

const buildTextResponse = (text: string, status = 200) =>
  new HttpResponse(text, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
    },
  });

const deptInfoCsv = ['01 内科', '02 外科', '03 小児科'].join(',');

export const orcaDeptInfoHandlers = [
  http.get('/api/orca/deptinfo', () => buildTextResponse(deptInfoCsv)),
  http.get('/api/orca/deptinfo', () => buildTextResponse(deptInfoCsv)),
];
