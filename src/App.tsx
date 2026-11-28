import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Track } from "./types/music";
import { useQueue } from "./hooks/useQueue";
import { getYouTubeThumbnail } from "./utils/thumbnail";
import "./App.css";

type MpvStatus = {
  playing: boolean;
  paused: boolean;
  title: string | null;
  position: number | null;
  duration: number | null;
  volume: number | null;
};

type Page = "home" | "search" | "library" | "playlists" | "queue";

function formatTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "0:00";

  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);

  return `${min}:${String(sec).padStart(2, "0")}`;
}

function App() {
  const [page, setPage] = useState<Page>("home");
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MpvStatus | null>(null);
  const [message, setMessage] = useState("プレーヤーを準備しています...");
  const [loading, setLoading] = useState(false);

  const [isArtworkRotating, setIsArtworkRotating] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState<"normal" | "fast">("normal");

  const {
    queue,
    currentIndex,
    currentTrack,
    repeatMode,
    addTrack,
    nextTrack,
    previousTrack,
    cycleRepeatMode,
    removeTrack,
    clearQueue,
    setCurrentIndex,
  } = useQueue();

  console.log({
    queue,
    currentIndex,
    currentTrack,
    repeatMode,
    addTrack,
    nextTrack,
    previousTrack,
    cycleRepeatMode,
  });

  async function refreshStatus() {
    try {
      const result = await invoke<MpvStatus>("mpv_get_status");
      setStatus(result);
    } catch {
      // mpvが起動していない場合は次の更新を待つ
    }
  }

  async function execute(command: string) {
    setLoading(true);

    try {
      await invoke(command);
      await refreshStatus();
      setMessage("プレーヤーを更新しました");
    } catch (error) {
      setMessage(`エラー: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function playUrl(event?: React.FormEvent) {
    event?.preventDefault();

    const targetUrl = url.trim();

    if (!targetUrl) {
      setMessage("再生URLを入力してください");
      return;
    }

    const track: Track = {
      id: crypto.randomUUID(),
      title: targetUrl,
      artist: "Unknown Artist",
      url: targetUrl,
      thumbnail: getYouTubeThumbnail(targetUrl),
    };

    setLoading(true);

    try {
      await invoke("mpv_play", { url: targetUrl });

      addTrack(track);

      setMessage("キューに追加して再生を開始しました");
      await refreshStatus();
    } catch (error) {
      setMessage(`再生エラー: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  function addUrlToQueue() {
    const targetUrl = url.trim();

    if (!targetUrl) {
      setMessage("追加するURLを入力してください");
      return;
    }

    const track: Track = {
      id: crypto.randomUUID(),
      title: targetUrl,
      artist: "Unknown Artist",
      url: targetUrl,
      thumbnail: getYouTubeThumbnail(targetUrl),
    };

    addTrack(track);
    setMessage("再生キューに追加しました");
    setUrl("");
  }

  async function playNextTrack() {
    const track = nextTrack();

    if (!track) {
      setMessage("次の曲はありません");
      return;
    }

    setLoading(true);

    try {
      await invoke("mpv_play", { url: track.url });
      setMessage(`次の曲を再生中: ${track.title}`);
      await refreshStatus();
    } catch (error) {
      setMessage(`次の曲の再生エラー: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function playPreviousTrack() {
    const track = previousTrack();

    if (!track) {
      setMessage("前の曲はありません");
      return;
    }

    setLoading(true);

    try {
      await invoke("mpv_play", { url: track.url });
      setMessage(`前の曲を再生中: ${track.title}`);
      await refreshStatus();
    } catch (error) {
      setMessage(`前の曲の再生エラー: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function initialize() {
      try {
        await invoke("mpv_start");

        if (!active) return;

        setMessage("プレーヤー接続済み");
        await refreshStatus();

        timer = setInterval(() => {
          if (active) refreshStatus();
        }, 1000);
      } catch (error) {
        if (active) {
          setMessage(`mpv起動エラー: ${String(error)}`);
        }
      }
    }

    initialize();

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  const progress =
    status?.position != null && status?.duration
      ? Math.min(100, Math.max(0, (status.position / status.duration) * 100))
      : 0;

  const currentTitle = status?.title || "再生待機中";
  const isPlaying = status?.playing && !status?.paused;

  const navigation: { id: Page; icon: string; label: string }[] = [
    { id: "home", icon: "⌂", label: "ホーム" },
    { id: "search", icon: "⌕", label: "検索" },
    { id: "queue", icon: "☷", label: "再生キュー" },
    { id: "library", icon: "▤", label: "ライブラリ" },
    { id: "playlists", icon: "♫", label: "プレイリスト" },
  ];



  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">R</div>
          <span>RSmusic</span>
        </div>

        <div className="nav-label">MENU</div>

        <nav className="navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-divider" />

        <div className="nav-label">YOUR COLLECTION</div>

        <button
          className="nav-item"
          onClick={() => setPage("playlists")}
        >
          <span className="nav-icon">＋</span>
          プレイリストを作成
        </button>

        <div className="sidebar-bottom">
          <div className="connection-indicator">
            <span className="status-dot" />
            <span>mpv player</span>
          </div>
          <span className="sidebar-version">RSmusic Player · 0.1.0</span>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="history-buttons">
            <button className="circle-button" title="戻る">‹</button>
            <button className="circle-button" title="進む">›</button>
          </div>

          <div className="topbar-search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (page !== "search") setPage("search");
              }}
              placeholder="曲名、アーティストを検索"
            />
          </div>

          <div className="profile">
            <div className="profile-avatar">Z</div>
            <span>Local User</span>
          </div>
        </header>

        <div className="content">
          {page === "home" && (
            <>
              <section className="welcome-section">
                <div>
                  <div className="eyebrow">YOUR PERSONAL MUSIC SPACE</div>
                  <h1>音楽を、もっと自由に。</h1>
                  <p>
                    自分の好きな音楽を、自分の環境で楽しもう。
                  </p>
                </div>
                <div className="hero-artwork-area">
                  <div
                    className={`hero-artwork ${
                      isArtworkRotating
                        ? rotationSpeed === "fast"
                          ? "rotating-fast"
                          : "rotating"
                        : ""
                    }`}
                  >
                    {currentTrack?.thumbnail ? (
                      <img
                        src={currentTrack.thumbnail}
                        alt={currentTrack.title}
                      />
                    ) : (
                      <span>♫</span>
                    )}
                  </div>

                  <button
                    className={`artwork-toggle ${isArtworkRotating ? "active" : ""}`}
                    onClick={() => setIsArtworkRotating((value) => !value)}
                    title={isArtworkRotating ? "回転を停止" : "ジャケットを回転"}
                  >
                    {isArtworkRotating ? "Ⅱ 停止" : "▶ 回転"}
                  </button>
                  <button
                    className="artwork-toggle"
                    onClick={() =>
                      setRotationSpeed((speed) =>
                        speed === "normal" ? "fast" : "normal"
                      )
                    }
                  >
                    {rotationSpeed === "normal" ? "⚡ 超高速回転" : "🐢 通常速度"}
                  </button>
                </div>
              </section>

              <section className="section">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">GET STARTED</div>
                    <h2>音楽を再生する</h2>
                  </div>
                </div>

                <div className="url-card">
                  <div className="url-card-icon">▶</div>
                  <div className="url-card-content">
                    <h3>URLから再生</h3>
                    <p>
                      音声ファイルや動画のURLを入力して再生できます。
                    </p>
                    <form className="url-form" onSubmit={playUrl}>
                      <input
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://example.com/audio.mp3"
                      />
                      <button type="submit" disabled={loading}>
                        ▶ 再生する
                      </button>

                      <button
                        type="button"
                        className="queue-add-button"
                        onClick={addUrlToQueue}
                      >
                        ＋ キューに追加
                      </button>
                    </form>
                  </div>
                </div>
              </section>

              <section className="section">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">YOUR PLAYER</div>
                    <h2>プレーヤーの状態</h2>
                  </div>
                </div>

                <div className="status-card">
                  <div className="status-art">
                    {currentTrack?.thumbnail ? (
                      <img
                        src={currentTrack.thumbnail}
                        alt={currentTrack.title}
                      />
                    ) : (
                      "♫"
                    )}
                  </div>
                  <div className="status-details">
                    <span className="status-label">NOW PLAYING</span>
                    <h3>{currentTitle}</h3>
                    <p>
                      {isPlaying
                        ? "現在再生中"
                        : status?.paused
                          ? "一時停止中"
                          : "再生待機中"}
                    </p>
                  </div>
                  <div className="status-time">
                    {formatTime(status?.position ?? null)}
                    <span> / </span>
                    {formatTime(status?.duration ?? null)}
                  </div>
                </div>
              </section>
            </>
          )}

          {page === "search" && (
            <section className="page-section">
              <div className="eyebrow">DISCOVER</div>
              <h1>検索</h1>
              <div className="search-large">
                <span>⌕</span>
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="曲名やアーティストを検索..."
                />
              </div>

              <div className="coming-soon">
                <div className="coming-icon">♫</div>
                <h2>{query ? `「${query}」を検索` : "音楽を探そう"}</h2>
                <p>
                  YouTube検索との連携は次の開発ステップで実装します。
                  現在はURLを指定して再生できます。
                </p>
                <button className="primary-button" onClick={() => setPage("home")}>
                  URLから再生する
                </button>
              </div>
            </section>
          )}

          {page === "library" && (
            <section className="page-section">
              <div className="eyebrow">YOUR MUSIC</div>
              <h1>ライブラリ</h1>
              <div className="empty-state">
                <div className="empty-icon">▤</div>
                <h2>ライブラリはまだ空です</h2>
                <p>
                  お気に入りや再生履歴をここに表示できるようにしていきます。
                </p>
              </div>
            </section>
          )}

          {page === "playlists" && (
            <section className="page-section">
              <div className="eyebrow">YOUR COLLECTION</div>
              <h1>プレイリスト</h1>
              <div className="empty-state">
                <div className="empty-icon">♫</div>
                <h2>プレイリストを作成しよう</h2>
                <p>
                  SQLiteによるプレイリスト保存機能は今後接続します。
                </p>
              </div>
            </section>
          )}
            {page === "queue" && (
              <section className="page-section">
                <div className="eyebrow">UP NEXT</div>
                <h1>再生キュー</h1>

                <div className="queue-header">
                  <span>{queue.length} 曲</span>
                  {queue.length > 0 && (
                    <button
                      className="artwork-toggle"
                      onClick={clearQueue}
                    >
                      キューをクリア
                    </button>
                  )}
                </div>

                {queue.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">☷</div>
                    <h2>再生キューは空です</h2>
                    <p>ホームから音楽を再生すると、ここに追加されます。</p>
                  </div>
                ) : (
                  <div className="queue-list">
                    {queue.map((track, index) => (
                      <div
                        className={`queue-item ${
                          index === currentIndex ? "active" : ""
                        }`}
                        key={track.id}
                      >
                        <div className="queue-art">
                          {track.thumbnail ? (
                            <img src={track.thumbnail} alt={track.title} />
                          ) : (
                            "♫"
                          )}
                        </div>

                        <div className="queue-info">
                          <div className="queue-title">{track.title}</div>
                          <div className="queue-artist">{track.artist}</div>
                        </div>

                        {index === currentIndex && (
                          <span className="queue-playing">再生中</span>
                        )}

                        <button
                          className="control-button"
                          title="この曲を再生"
                          disabled={loading}
                          onClick={async () => {
                            try {
                              setLoading(true);
                              await invoke("mpv_play", { url: track.url });
                              setCurrentIndex(index);
                              await refreshStatus();
                            } catch (error) {
                              setMessage(String(error));
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          ▶
                        </button>

                        <button
                          className="control-button"
                          title="キューから削除"
                          onClick={() => removeTrack(index)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
        </div>

        <footer className="player-bar">
          <div className="player-track">
            <div className="mini-art">
              {currentTrack?.thumbnail ? (
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                />
              ) : (
                "♫"
              )}
            </div>
            <div className="track-info">
              <strong>{currentTitle}</strong>
              <span>{status?.playing ? "mpv playback" : "No track playing"}</span>
            </div>
          </div>

          <div className="player-controls">
            <div className="control-buttons">

              <button
                className={`control-button ${repeatMode !== "off" ? "active" : ""}`}
                title={`リピート: ${repeatMode.toUpperCase()}`}
                onClick={cycleRepeatMode}
              >
                {repeatMode === "one" ? "↻¹" : "↻"}
              </button>

              <button
                className="control-button"
                title="前の曲"
                onClick={playPreviousTrack}
                disabled={loading || queue.length === 0}
              >
                ◀
              </button>

              <button
                className="control-button"
                title="停止"
                onClick={() => execute("mpv_stop")}
                disabled={loading}
              >
                ■
              </button>

              <button
                className="play-button"
                title={status?.paused ? "再開" : "一時停止"}
                onClick={() =>
                  execute(status?.paused ? "mpv_resume" : "mpv_pause")
                }
                disabled={loading || !status?.playing}
              >
                {status?.paused ? "▶" : "Ⅱ"}
              </button>

              <button
                className="control-button"
                title="次の曲"
                onClick={playNextTrack}
                disabled={loading || currentIndex >= queue.length - 1 && repeatMode !== "all"}
              >
                ▶|
              </button>
            </div>

            <div className="progress-row">
              <span>{formatTime(status?.position ?? null)}</span>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span>{formatTime(status?.duration ?? null)}</span>
            </div>
          </div>

          <div className="player-extra">
            <span className={`live-dot ${isPlaying ? "playing" : ""}`} />
            <span>{isPlaying ? "PLAYING" : "IDLE"}</span>
          </div>
        </footer>
      </main>

      <div className="toast">{message}</div>
    </div>
  );
}

export default App;
