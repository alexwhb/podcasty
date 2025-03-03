import { data, type LoaderFunctionArgs } from 'react-router'
import { ResumeSchema } from '#app/utils/chunk-upload/upload-utils.ts'
import { prisma } from '#app/utils/db.server.ts'


async function getUploadedChunks(uploadId: string): Promise<number[]> {
  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
    include: { uploadedChunks: true },
  });
  return upload ? upload.uploadedChunks.map((chunk) => chunk.chunkIndex) : [];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId");

  const validation = ResumeSchema.safeParse({ uploadId });
  if (!validation.success) {
    return data({ error: validation.error.errors[0]?.message }, { status: 400 });
  }

  const uploadedChunks = await getUploadedChunks(uploadId!);
  return data({ uploadedChunks });
}