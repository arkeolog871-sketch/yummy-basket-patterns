import { cn } from "@/lib/utils";
import { contentTypeForBrandPath, isAdVideoUrl } from "@/lib/upload-limits";

export function AdMedia({
  src,
  alt = "",
  className,
  active = false,
  priority = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  /** Current carousel slide — play muted video; pause otherwise. */
  active?: boolean;
  priority?: boolean;
}) {
  if (isAdVideoUrl(src)) {
    return (
      <video
        className={cn("pointer-events-none size-full object-cover", className)}
        muted
        loop
        playsInline
        autoPlay={active}
        preload={priority || active ? "auto" : "metadata"}
        controls={false}
        disablePictureInPicture
        ref={(node) => {
          if (!node) return;
          if (active) void node.play().catch(() => undefined);
          else node.pause();
        }}
      >
        <source src={src} type={contentTypeForBrandPath(src)} />
      </video>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={cn("size-full object-cover", className)}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
    />
  );
}
