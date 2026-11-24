import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO...).
 * Objects are private; downloads use short-lived signed URLs.
 */
export function createS3Adapter({ endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle }) {
  const client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
  return {
    name: "s3",
    bucket,
    async put(key, body, { contentType }) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: endpoint ? undefined : "AES256" }));
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async signedUrl(key, { expiresInSeconds = 300, downloadName } = {}) {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: downloadName ? `attachment; filename="${downloadName}"` : undefined,
      });
      return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    },
  };
}
