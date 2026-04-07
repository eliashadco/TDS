import Image, { type ImageProps } from "next/image";

export default function SafeImage(props: ImageProps) {
  return <Image {...props} alt={props.alt || "image"} />;
}
