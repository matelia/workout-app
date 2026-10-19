import { useVideoPlayer, VideoView } from 'expo-video';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Button, T } from '@/components/ui';
import type { VideoType } from '@/db/repos/exercises';
import { instagramEmbedUrl, localVideoUri, youtubeId } from '@/lib/video';
import { radius, useColors } from '@/theme';

export function VideoPlayer({ type, value }: { type: VideoType; value: string }) {
  if (type === 'youtube') return <YouTube url={value} />;
  if (type === 'instagram') return <Instagram url={value} />;
  return <LocalVideo path={value} />;
}

function YouTube({ url }: { url: string }) {
  const id = youtubeId(url);
  if (!id) return <T variant="muted">Invalid YouTube link.</T>;
  // Loaded as inline HTML with an https baseUrl so YouTube receives a Referer
  // (embeds without one fail with "Error 153").
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe src="https://www.youtube.com/embed/${id}?playsinline=1&rel=0"
allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen
referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`;
  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.frame, { aspectRatio: 16 / 9 }]}>
        <WebView
          source={{ html, baseUrl: 'https://workoutapp.local' }}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          style={styles.web}
        />
      </View>
      <Button title="Open in YouTube" variant="secondary" onPress={() => Linking.openURL(url)} />
    </View>
  );
}

function Instagram({ url }: { url: string }) {
  const embed = instagramEmbedUrl(url);
  if (!embed) return <T variant="muted">Invalid Instagram link.</T>;
  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.frame, { height: 560 }]}>
        <WebView
          source={{ uri: embed }}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          style={styles.web}
        />
      </View>
      <Button title="Open in Instagram" variant="secondary" onPress={() => Linking.openURL(url)} />
    </View>
  );
}

function LocalVideo({ path }: { path: string }) {
  const c = useColors();
  const player = useVideoPlayer(localVideoUri(path), (p) => {
    p.loop = true;
  });
  return (
    <View style={[styles.frame, { aspectRatio: 16 / 9, borderColor: c.border }]}>
      <VideoView player={player} style={styles.web} nativeControls contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
});
