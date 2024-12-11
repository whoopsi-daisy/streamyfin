import React, { useCallback, useMemo, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DropdownMenu from "zeego/dropdown-menu";
import { useControlContext } from "../contexts/ControlContext";
import { useVideoContext } from "../contexts/VideoContext";
import { TranscodedSubtitle } from "../types";
import { useAtomValue } from "jotai";
import { apiAtom } from "@/providers/JellyfinProvider";
import { useLocalSearchParams, useRouter } from "expo-router";

interface DropdownViewProps {
  showControls: boolean;
  offline?: boolean; // used to disable external subs for downloads
}

const DropdownView: React.FC<DropdownViewProps> = ({ showControls }) => {
  const router = useRouter();
  const api = useAtomValue(apiAtom);
  const ControlContext = useControlContext();
  const mediaSource = ControlContext?.mediaSource;
  const item = ControlContext?.item;
  const isVideoLoaded = ControlContext?.isVideoLoaded;

  const videoContext = useVideoContext();
  const { subtitleTracks, setSubtitleTrack } = videoContext;

  const { subtitleIndex, audioIndex, bitrateValue } = useLocalSearchParams<{
    itemId: string;
    audioIndex: string;
    subtitleIndex: string;
    mediaSourceId: string;
    bitrateValue: string;
  }>();

  // Either its on a text subtitle or its on not on any subtitle therefore it should show all the embedded HLS subtitles.
  const isOnTextSubtitle =
    mediaSource?.MediaStreams?.find(
      (x) => x.Index === parseInt(subtitleIndex) && x.IsTextSubtitleStream
    ) || subtitleIndex === "-1";

  const allSubs =
    mediaSource?.MediaStreams?.filter((x) => x.Type === "Subtitle") ?? [];
  const textBasedSubs = allSubs.filter((x) => x.IsTextSubtitleStream);

  const allSubtitleTracksForTranscodingStream = useMemo(() => {
    const disableSubtitle = {
      name: "Disable",
      index: -1,
      IsTextSubtitleStream: true,
    } as TranscodedSubtitle;
    if (isOnTextSubtitle) {
      const textSubtitles =
        subtitleTracks?.map((s) => ({
          name: s.name,
          index: s.index,
          IsTextSubtitleStream: true,
        })) || [];

      console.log("textSubtitles", textSubtitles);

      let textIndex = 0; // To track position in textSubtitles
      // Merge text and image subtitles in the order of allSubs
      const sortedSubtitles = allSubs.map((sub) => {
        if (sub.IsTextSubtitleStream) {
          if (textSubtitles.length === 0) return disableSubtitle;
          const textSubtitle = textSubtitles[textIndex];
          textIndex++;
          return textSubtitle;
        } else {
          return {
            name: sub.DisplayTitle!,
            index: sub.Index!,
            IsTextSubtitleStream: sub.IsTextSubtitleStream,
          } as TranscodedSubtitle;
        }
      });

      console.log("sortedSubtitles", sortedSubtitles);

      return [disableSubtitle, ...sortedSubtitles];
    }

    const transcodedSubtitle: TranscodedSubtitle[] = allSubs.map((x) => ({
      name: x.DisplayTitle!,
      index: x.Index!,
      IsTextSubtitleStream: x.IsTextSubtitleStream!,
    }));

    return [disableSubtitle, ...transcodedSubtitle];
  }, [item, isVideoLoaded, subtitleTracks, mediaSource?.MediaStreams]);

  const ChangeTranscodingSubtitle = useCallback(
    (subtitleIndex: number) => {
      const queryParams = new URLSearchParams({
        itemId: item.Id ?? "", // Ensure itemId is a string
        audioIndex: audioIndex?.toString() ?? "",
        subtitleIndex: subtitleIndex?.toString() ?? "",
        mediaSourceId: mediaSource?.Id ?? "", // Ensure mediaSourceId is a string
        bitrateValue: bitrateValue,
      }).toString();

      // @ts-expect-error
      router.replace(`player/transcoding-player?${queryParams}`);
    },
    [mediaSource]
  );

  // Audio tracks for transcoding streams.
  const allAudio =
    mediaSource?.MediaStreams?.filter((x) => x.Type === "Audio").map((x) => ({
      name: x.DisplayTitle!,
      index: x.Index!,
    })) || [];

  // HLS stream indexes are not the same as the actual source indexes.
  // This function aims to get the source subtitle index from the embedded track index.
  const getSourceSubtitleIndex = (embeddedTrackIndex: number): number => {
    // If we're not on text-based subtitles, return the embedded track index
    if (!isOnTextSubtitle) {
      return parseInt(subtitleIndex);
    }
    return textBasedSubs[embeddedTrackIndex]?.Index ?? -1;
  };

  const ChangeTranscodingAudio = useCallback(
    (audioIndex: number) => {
      console.log("ChangeTranscodingAudio", subtitleIndex, audioIndex);
      const queryParams = new URLSearchParams({
        itemId: item.Id ?? "", // Ensure itemId is a string
        audioIndex: audioIndex?.toString() ?? "",
        subtitleIndex: subtitleIndex?.toString() ?? "",
        mediaSourceId: mediaSource?.Id ?? "", // Ensure mediaSourceId is a string
        bitrateValue: bitrateValue,
      }).toString();

      // @ts-expect-error
      router.replace(`player/transcoding-player?${queryParams}`);
    },
    [mediaSource, subtitleIndex, audioIndex]
  );

  return (
    <View
      style={{
        position: "absolute",
        zIndex: 1000,
        opacity: showControls ? 1 : 0,
      }}
      className="p-4"
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <TouchableOpacity className="aspect-square flex flex-col bg-neutral-800/90 rounded-xl items-center justify-center p-2">
            <Ionicons name="ellipsis-horizontal" size={24} color={"white"} />
          </TouchableOpacity>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          loop={true}
          side="bottom"
          align="start"
          alignOffset={0}
          avoidCollisions={true}
          collisionPadding={8}
          sideOffset={8}
        >
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger key="subtitle-trigger">
              Subtitle
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent
              alignOffset={-10}
              avoidCollisions={true}
              collisionPadding={0}
              loop={true}
              sideOffset={10}
            >
              {allSubtitleTracksForTranscodingStream?.map(
                (sub, idx: number) => (
                  <DropdownMenu.CheckboxItem
                    value={
                      subtitleIndex ===
                      (sub.IsTextSubtitleStream && isOnTextSubtitle
                        ? getSourceSubtitleIndex(sub.index).toString()
                        : sub?.index.toString())
                    }
                    key={`subtitle-item-${idx}`}
                    onValueChange={() => {
                      console.log("sub", sub);
                      if (
                        subtitleIndex ===
                        (sub.IsTextSubtitleStream && isOnTextSubtitle
                          ? getSourceSubtitleIndex(sub.index).toString()
                          : sub?.index.toString())
                      )
                        return;

                      router.setParams({
                        subtitleIndex: getSourceSubtitleIndex(
                          sub.index
                        ).toString(),
                      });
                      console.log("Got here");

                      if (sub.IsTextSubtitleStream && isOnTextSubtitle) {
                        setSubtitleTrack && setSubtitleTrack(sub.index);
                        return;
                      }
                      console.log("ChangeTranscodingSubtitle", subtitleIndex);
                      ChangeTranscodingSubtitle(sub.index);
                    }}
                  >
                    <DropdownMenu.ItemTitle key={`subtitle-item-title-${idx}`}>
                      {sub.name}
                    </DropdownMenu.ItemTitle>
                  </DropdownMenu.CheckboxItem>
                )
              )}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger key="audio-trigger">
              Audio
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent
              alignOffset={-10}
              avoidCollisions={true}
              collisionPadding={0}
              loop={true}
              sideOffset={10}
            >
              {allAudio?.map((track, idx: number) => (
                <DropdownMenu.CheckboxItem
                  key={`audio-item-${idx}`}
                  value={audioIndex === track.index.toString()}
                  onValueChange={() => {
                    if (audioIndex === track.index.toString()) return;
                    console.log("Setting audio track to: ", track.index);
                    router.setParams({
                      audioIndex: track.index.toString(),
                    });
                    ChangeTranscodingAudio(track.index);
                  }}
                >
                  <DropdownMenu.ItemTitle key={`audio-item-title-${idx}`}>
                    {track.name}
                  </DropdownMenu.ItemTitle>
                </DropdownMenu.CheckboxItem>
              ))}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </View>
  );
};

export default DropdownView;
