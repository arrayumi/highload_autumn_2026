import { check } from 'k6';
import http from 'k6/http';
import { sleep } from 'k6';

const baseUrl = __ENV.TARGET_URL || 'http://crud-service:3001';

const error500Rate = 0.02;
const error404Rate = 0.03;
const error400Rate = 0.01;

export const options = {
  vus: 40,
  duration: '4h',
  stages: [
    { duration: '3m', target: 40 },
  ],
};

export default function () {
  const r = Math.random();

  if (r < error500Rate) {
    http.get(`${baseUrl}/items?forceError=500`);
  } else if (r < error500Rate + error404Rate) {
    http.get(`${baseUrl}/items/999999999`);
  } else if (r < error500Rate + error404Rate + error400Rate) {
    const res = http.post(`${baseUrl}/items`, JSON.stringify({}), {
      headers: { 'Content-Type': 'application/json' },
    });
    // можно добавить проверку, если хочешь
    check(res, { 'status is 400': (r) => r.status === 400 });
  } else {
    const path = Math.floor(Math.random() * 4);
    switch (path) {
      case 0:
        http.get(`${baseUrl}/items`);
        break;
      case 1:
        http.post(`${baseUrl}/items`, JSON.stringify({ name: 'test-item', description: 'test desc' }), {
          headers: { 'Content-Type': 'application/json' }
        });
        break;
      case 2:
        http.get(`${baseUrl}/items/1`);
        break;
      case 3:
        // в k6 нет http.delete как отдельного метода — используем http.request
        http.request('DELETE', `${baseUrl}/items/1`);
        break;
    }
  }

  sleep(0.1);
}
