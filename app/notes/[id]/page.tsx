import { NoteEditorView } from "@/components/views/NoteEditorView";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NoteEditorView id={id} />;
}
