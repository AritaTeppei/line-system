'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Announcement = {
  id: number;
  title: string;
  body: string;
  publishAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('auth_token') ?? window.localStorage.getItem('auth_token');
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// datetime-local の value 用 (JST)
function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 現在時刻+1時間をデフォルト値に
function defaultPublishAt() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = { title: '', body: '', publishAt: defaultPublishAt(), isActive: true };

export default function AdminAnnouncementsPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フォーム state
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // 削除確認
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const token = getAuthToken();

  const fetchAll = async () => {
    if (!token) return;
    const res = await fetch(`${apiBase}/announcements`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('取得に失敗しました');
    const data: Announcement[] = await res.json();
    setAnnouncements(data);
  };

  useEffect(() => {
    if (!token) { setError('ログインしてください'); setLoading(false); return; }
    fetchAll()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const url = editingId
        ? `${apiBase}/announcements/${editingId}`
        : `${apiBase}/announcements`;
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          publishAt: new Date(form.publishAt).toISOString(),
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? '保存に失敗しました');
      }
      setSaveSuccess(editingId ? 'お知らせを更新しました' : 'お知らせを作成しました');
      setForm({ ...EMPTY_FORM, publishAt: defaultPublishAt() });
      setEditingId(null);
      await fetchAll();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      body: a.body,
      publishAt: toLocalDatetimeValue(a.publishAt),
      isActive: a.isActive,
    });
    setSaveError(null);
    setSaveSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/announcements/${deleteTargetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('削除に失敗しました');
      setDeleteTargetId(null);
      await fetchAll();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, publishAt: defaultPublishAt() });
    setSaveError(null);
    setSaveSuccess(null);
  };

  const now = new Date();

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse text-sm">読み込み中...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="rounded-2xl bg-red-950 border border-red-800 p-6 text-red-300 text-sm max-w-sm w-full text-center">{error}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl">📢</span>
            <div>
              <h1 className="text-sm font-black text-white">お知らせ管理</h1>
              <p className="text-[11px] text-gray-500 hidden sm:block">テナントへのお知らせ配信</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/admin/overview')}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            ← 概要画面
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* フォーム */}
        <div className="rounded-2xl bg-gray-900 border border-gray-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">
              {editingId ? '✏️ お知らせを編集' : '＋ 新しいお知らせを作成'}
            </h2>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="text-xs text-gray-400 hover:text-white transition-colors">
                キャンセル
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* タイトル */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">タイトル <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例：機能アップデートのお知らせ"
                required
                className="w-full rounded-xl bg-gray-800 border border-gray-600 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* 本文 */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">本文 <span className="text-red-400">*</span></label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="お知らせの詳細内容を入力してください..."
                required
                rows={6}
                className="w-full rounded-xl bg-gray-800 border border-gray-600 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
            </div>

            {/* 配信日時 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">配信日時 <span className="text-red-400">*</span></label>
                <input
                  type="datetime-local"
                  value={form.publishAt}
                  onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
                  required
                  className="w-full rounded-xl bg-gray-800 border border-gray-600 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="mt-1 text-[10px] text-gray-500">設定日時以降にログインしたユーザーに表示されます</p>
              </div>
              <div className="flex flex-col justify-center">
                <label className="block text-xs font-semibold text-gray-400 mb-2">公開ステータス</label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${form.isActive ? 'bg-green-500' : 'bg-gray-600'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'left-6' : 'left-1'}`} />
                  </div>
                  <span className={`text-sm font-semibold ${form.isActive ? 'text-green-400' : 'text-gray-500'}`}>
                    {form.isActive ? '公開' : '非公開'}
                  </span>
                </label>
              </div>
            </div>

            {saveError && (
              <div className="rounded-xl bg-red-950 border border-red-800 px-4 py-2.5 text-sm text-red-300">{saveError}</div>
            )}
            {saveSuccess && (
              <div className="rounded-xl bg-emerald-950 border border-emerald-800 px-4 py-2.5 text-sm text-emerald-300">✅ {saveSuccess}</div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors disabled:opacity-60"
              >
                {saving ? '保存中...' : editingId ? '更新する' : '作成する'}
              </button>
            </div>
          </form>
        </div>

        {/* 一覧 */}
        <div className="rounded-2xl bg-gray-900 border border-gray-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-700">
            <h2 className="text-sm font-bold text-white">📋 配信済み・予定一覧</h2>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-gray-500 px-5 py-8 text-center">まだお知らせがありません</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {announcements.map((a) => {
                const published = new Date(a.publishAt) <= now;
                return (
                  <div key={a.id} className="px-5 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          !a.isActive
                            ? 'bg-gray-800 text-gray-500 border-gray-700'
                            : published
                            ? 'bg-green-900/50 text-green-400 border-green-700'
                            : 'bg-amber-900/50 text-amber-400 border-amber-700'
                        }`}>
                          {!a.isActive ? '非公開' : published ? '配信中' : '配信予定'}
                        </span>
                        <h3 className="text-sm font-bold text-white truncate">{a.title}</h3>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEdit(a)}
                          className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 rounded-lg px-2.5 py-1 transition-colors"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(a.id)}
                          className="text-xs text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 rounded-lg px-2.5 py-1 transition-colors"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 whitespace-pre-line">{a.body}</p>
                    <p className="text-[10px] text-gray-600">
                      配信日時: {fmtDatetime(a.publishAt)}
                      {!published && (
                        <span className="ml-2 text-amber-600">
                          （あと {Math.ceil((new Date(a.publishAt).getTime() - now.getTime()) / 3600000)} 時間後）
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 削除確認モーダル */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-900 border border-gray-700 p-6 space-y-4">
            <p className="text-sm font-bold text-white text-center">このお知らせを削除しますか？</p>
            <p className="text-xs text-gray-400 text-center">
              「{announcements.find((a) => a.id === deleteTargetId)?.title}」
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-600 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-sm text-white font-bold transition-colors disabled:opacity-60"
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
