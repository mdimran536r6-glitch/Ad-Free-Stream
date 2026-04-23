import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useLibrary } from "@/contexts/LibraryContext";
import { useColors } from "@/hooks/useColors";
import { downloadMedia } from "@/lib/downloads";
import { bestAudio, extractChannelId, pickVideoStream, pipedStream } from "@/lib/piped";

interface Props {
  visible: boolean;
  onClose: () => void;
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  channelUrl?: string;
}

export function VideoActionSheet({
  visible,
  onClose,
  videoId,
  title,
  artist,
  thumbnail,
  duration,
  channelUrl,
}: Props) {
  const colors = useColors();
  const router = useRouter();
  const { save, remove, isSaved, addDownload } = useLibrary();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const saved = isSaved(videoId);

  const close = () => {
    if (!busy) onClose();
  };

  const handleSave = async () => {
    if (saved) await remove(videoId);
    else await save({ videoId, title, artist, thumbnail, duration, kind: "audio" });
    onClose();
  };

  const handleDownload = async (kind: "audio" | "video") => {
    try {
      setBusy(kind === "audio" ? "Downloading audio…" : "Downloading video…");
      setProgress(0);
      const data = await pipedStream(videoId);
      let url: string | null = null;
      let format: "m4a" | "mp4" | "webm" = "m4a";
      if (kind === "audio") {
        const a = bestAudio(data.audioStreams);
        if (!a) throw new Error("No audio stream");
        url = a.url;
        format = a.mimeType?.includes("mp4") ? "m4a" : "webm";
      } else {
        const v = pickVideoStream(data.videoStreams ?? [], 720);
        if (!v) throw new Error("No video stream");
        url = v.url;
        format = v.mimeType?.includes("mp4") ? "mp4" : "webm";
      }
      const res = await downloadMedia(
        url,
        `${title} - ${artist}`,
        format,
        (p) => setProgress(p.ratio),
      );
      await addDownload({
        videoId,
        title,
        artist,
        thumbnail,
        duration,
        format,
        localUri: res.uri,
        size: res.size,
      });
      setBusy(null);
      onClose();
    } catch (err) {
      console.warn("[download]", err);
      setBusy(null);
    }
  };

  const handleShare = async () => {
    onClose();
    try {
      await Share.share({
        message: `${title}\nhttps://youtu.be/${videoId}`,
        url: `https://youtu.be/${videoId}`,
        title,
      });
    } catch {}
  };

  const handleChannel = () => {
    onClose();
    if (channelUrl) router.push(`/channel/${extractChannelId(channelUrl)}`);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text numberOfLines={2} style={[styles.title, { color: colors.foreground }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {artist}
          </Text>

          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.busyText, { color: colors.foreground }]}>{busy}</Text>
              <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
                <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Action icon={saved ? "check" : "bookmark"} label={saved ? "Saved" : "Save"} onPress={handleSave} />
              <Action icon="music" label="Download M4A (audio)" onPress={() => handleDownload("audio")} />
              <Action icon="film" label="Download MP4 (video)" onPress={() => handleDownload("video")} />
              {channelUrl ? <Action icon="user" label="View channel" onPress={handleChannel} /> : null}
              <Action icon="share-2" label="Share" onPress={handleShare} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Action({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Feather name={icon} size={20} color={colors.foreground} />
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actions: { marginTop: 12, gap: 2 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 14 },
  actionLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  busy: { paddingVertical: 24, alignItems: "center", gap: 10 },
  busyText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  progressBg: { width: "100%", height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%" },
});
