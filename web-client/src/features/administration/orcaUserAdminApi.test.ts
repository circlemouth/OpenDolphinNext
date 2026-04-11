import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createOrcaUser,
  fetchOrcaUsers,
  isValidOrcaUserId,
  linkEhrUserToOrca,
  updateOrcaUser,
} from './orcaUserAdminApi';
import { httpFetch } from '../../libs/http/httpClient';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

const mockHttpFetch = vi.mocked(httpFetch);

beforeEach(() => {
  mockHttpFetch.mockReset();
});

describe('orcaUserAdminApi', () => {
  it('ORCAユーザー一覧と同期ステータスを正規化して返す', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          runId: 'RUN-ORCA-USERS-1',
          users: [
            {
              User_Id: 'doctor_01',
              name: '山田 太郎',
              kana: 'ヤマダ タロウ',
              staffClass: 'doctor',
              staffNumber: '10001',
              isAdmin: true,
              link: {
                linked: true,
                ehrUserId: 'ehr-user-1',
                ehrLoginId: 'dolphindev',
              },
            },
          ],
          syncStatus: {
            running: false,
            lastSyncAt: '2026-02-12T00:00:00Z',
            lastSyncCount: 12,
            recentErrorSummary: 'none',
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'x-trace-id': 'TRACE-ORCA-USERS-1',
          },
        },
      ),
    );

    const result = await fetchOrcaUsers();

    expect(result.ok).toBe(true);
    expect(result.runId).toBe('RUN-ORCA-USERS-1');
    expect(result.traceId).toBe('TRACE-ORCA-USERS-1');
    expect(result.users).toHaveLength(1);
    expect(result.users[0].userId).toBe('doctor_01');
    expect(result.users[0].fullName).toBe('山田 太郎');
    expect(result.users[0].fullNameKana).toBe('ヤマダ タロウ');
    expect(result.users[0].isAdmin).toBe(true);
    expect(result.users[0].link.linked).toBe(true);
    expect(result.users[0].link.ehrUserId).toBe('ehr-user-1');
    expect(result.syncStatus.lastSyncedAt).toBe('2026-02-12T00:00:00Z');
    expect(result.syncStatus.syncedCount).toBe(12);
    expect(result.syncStatus.recentErrorSummary).toBe('none');
  });

  it('ORCA User_Id バリデーションを行う', () => {
    expect(isValidOrcaUserId('doctor_01')).toBe(true);
    expect(isValidOrcaUserId('A1_B2')).toBe(true);

    expect(isValidOrcaUserId('doctor-01')).toBe(false);
    expect(isValidOrcaUserId('医師01')).toBe(false);
    expect(isValidOrcaUserId('')).toBe(false);
  });

  it('作成失敗時に Api_Result を含む入力エラーを返す', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          Api_Result: 'E90',
          Api_Result_Message: 'invalid User_Id',
          runId: 'RUN-CREATE-FAIL',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(
      createOrcaUser({
        userId: 'doctor-01',
        password: 'password',
        staffClass: 'doctor',
        fullName: '山田 太郎',
      }),
    ).rejects.toMatchObject({
      kind: 'input',
      status: 400,
      apiResult: 'E90',
      apiResultMessage: 'invalid User_Id',
      runId: 'RUN-CREATE-FAIL',
    });
  });

  it('リンク競合時に conflict エラーを返す', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          Api_Result: 'E31',
          Api_Result_Message: 'already linked',
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(
      linkEhrUserToOrca('ehr-user-1', {
        orcaUserId: 'doctor_01',
      }),
    ).rejects.toMatchObject({
      kind: 'conflict',
      status: 409,
      apiResult: 'E31',
      apiResultMessage: 'already linked',
    });
  });

  it('作成時に official create request と一致する payload を送る', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, user: { userId: 'doctor_01' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await createOrcaUser({
      userId: 'doctor_01',
      password: 'password',
      staffClass: '01',
      fullName: '山田 太郎',
      fullNameKana: 'ヤマダ タロウ',
      isAdmin: true,
    });

    const [, init] = mockHttpFetch.mock.calls[0];
    if (!init) throw new Error('fetch init is undefined');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      userId: 'doctor_01',
      password: 'password',
      staffClass: '01',
      fullName: '山田 太郎',
      fullNameKana: 'ヤマダ タロウ',
      User_Id: 'doctor_01',
      Password: 'password',
      Staff_Class: '01',
      WholeName: '山田 太郎',
      WholeName_inKana: 'ヤマダ タロウ',
      Admin_Flag: true,
    });
    expect(body).not.toHaveProperty('staffNumber');
    expect(body).not.toHaveProperty('Staff_Number');
    expect(body).not.toHaveProperty('User_Number');
  });

  it('更新時に immutable fields を含めない payload を送る', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, user: { userId: 'doctor_01' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await updateOrcaUser('doctor_01', {
      password: 'next-pass',
      fullName: '更新 太郎',
      fullNameKana: 'コウシン タロウ',
      isAdmin: false,
    });

    const [, init] = mockHttpFetch.mock.calls[0];
    if (!init) throw new Error('fetch init is undefined');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      password: 'next-pass',
      fullName: '更新 太郎',
      fullNameKana: 'コウシン タロウ',
      Password: 'next-pass',
      WholeName: '更新 太郎',
      WholeName_inKana: 'コウシン タロウ',
      Admin_Flag: false,
    });
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('staffClass');
    expect(body).not.toHaveProperty('staffNumber');
    expect(body).not.toHaveProperty('User_Id');
    expect(body).not.toHaveProperty('Staff_Class');
    expect(body).not.toHaveProperty('Staff_Number');
  });
});
