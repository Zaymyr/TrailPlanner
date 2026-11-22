import { VideoGeneratorStudio } from "../../video-generator/VideoGeneratorStudio";

/** Studio vidéo: the 3D video generator (modules stay under `app/admin/video-generator/`, imported by the render pages). */
export default function AdminContentStudioPage() {
  return <VideoGeneratorStudio />;
}
