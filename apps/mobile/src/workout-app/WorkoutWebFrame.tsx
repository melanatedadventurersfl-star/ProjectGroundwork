'use dom';

import { useEffect, useMemo, useRef, useState } from 'react';

type HealthPayload = Record<string, unknown>;

type Props = {
  url: string;
  healthRequest: (action: string, payload: HealthPayload) => Promise<unknown>;
  dom?: import('expo/dom').DOMProps;
};

const CHANNEL = 'goworkout-health-connect';

function nativeWorkoutUrl(value: string) {
  const url = new URL(value);
  url.searchParams.set('nativeBridge', '1');
  url.searchParams.set('app', 'android');
  return url.toString();
}

export default function WorkoutWebFrame({ url, healthRequest }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const workoutUrl = useMemo(() => nativeWorkoutUrl(url), [url]);
  const expectedOrigin = useMemo(() => new URL(workoutUrl).origin, [workoutUrl]);

  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.origin !== expectedOrigin) return;
      const message = event.data;
      if (!message || message.channel !== CHANNEL || !message.requestId || !message.action) return;

      try {
        const result = await healthRequest(
          String(message.action),
          message.payload && typeof message.payload === 'object' ? message.payload : {},
        );
        frameRef.current?.contentWindow?.postMessage(
          { channel: CHANNEL, requestId: message.requestId, ok: true, result },
          expectedOrigin,
        );
      } catch (error) {
        frameRef.current?.contentWindow?.postMessage(
          {
            channel: CHANNEL,
            requestId: message.requestId,
            ok: false,
            error: error instanceof Error ? error.message : 'Native health request failed.',
          },
          expectedOrigin,
        );
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [expectedOrigin, healthRequest]);

  return (
    <main style={{ position: 'fixed', inset: 0, margin: 0, background: '#0A0D0B', overflow: 'hidden' }}>
      {!loaded && !failed ? (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          background: '#0A0D0B',
          color: '#F7FAF8',
          fontFamily: 'Inter, system-ui, sans-serif',
          zIndex: 2,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 900, letterSpacing: '.08em', fontSize: 24 }}>GO WORKOUT</div>
            <div style={{ marginTop: 10, color: '#96A19B', fontSize: 13 }}>Opening your training…</div>
          </div>
        </div>
      ) : null}
      {failed ? (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          padding: 28,
          background: '#0A0D0B',
          color: '#F7FAF8',
          fontFamily: 'Inter, system-ui, sans-serif',
          zIndex: 3,
        }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <strong style={{ fontSize: 20 }}>Go Workout could not load.</strong>
            <p style={{ color: '#96A19B', lineHeight: 1.5 }}>Check your connection and reopen the app.</p>
          </div>
        </div>
      ) : null}
      <iframe
        ref={frameRef}
        src={workoutUrl}
        title="GO Workout"
        onLoad={() => {
          setLoaded(true);
          setFailed(false);
        }}
        onError={() => setFailed(true)}
        allow="autoplay; clipboard-read; clipboard-write"
        style={{ width: '100%', height: '100%', border: 0, background: '#0A0D0B' }}
      />
    </main>
  );
}
