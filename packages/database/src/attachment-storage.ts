export const WEDDING_FILES_BUCKET_ID = "wedding-files" as const;

export type AttachmentLocator = {
  attachmentId: string;
  bucketId: typeof WEDDING_FILES_BUCKET_ID;
  objectPath: string;
};
