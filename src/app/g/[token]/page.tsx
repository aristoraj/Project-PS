import { notFound } from "next/navigation";
import Gallery from "@/components/Gallery";
import { getGalleryByToken, getSelections } from "@/lib/db";
import { listPhotos } from "@/lib/drive";

export const dynamic = "force-dynamic";

export default async function ClientGalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gallery = await getGalleryByToken(token);
  if (!gallery) notFound();

  let photos: { id: string; name: string }[] = [];
  let loadError = false;
  try {
    photos = (await listPhotos(gallery.drive_folder_id)).map((p) => ({ id: p.id, name: p.name }));
  } catch {
    loadError = true;
  }

  const selections = await getSelections(gallery.id);

  if (loadError) {
    return (
      <main className="gallery-empty">
        <h1>{gallery.client_name}</h1>
        <p>We couldn&apos;t load the photos right now. Please try again in a few minutes.</p>
      </main>
    );
  }

  return (
    <Gallery
      token={token}
      clientName={gallery.client_name}
      photos={photos}
      initialSelected={selections.map((s) => s.file_id)}
      initiallySubmitted={gallery.status === "submitted"}
    />
  );
}
