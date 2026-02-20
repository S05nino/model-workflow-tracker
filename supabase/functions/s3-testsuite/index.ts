import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "npm:@aws-sdk/client-s3@3.600.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.600.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const S3_BUCKET = "s3-crif-studio-wwcc1mnt-de-prd-datalake";
const S3_PREFIX = "CategorizationEngineTestSuite/TEST_SUITE/";

function getS3Client(): S3Client {
  const region = Deno.env.get("AWS_REGION");
  const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("AWS credentials not configured");
  }

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "list") {
      const relPath = url.searchParams.get("path") || "";
      const prefix = S3_PREFIX + relPath;
      const client = getS3Client();

      const command = new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        Delimiter: "/",
      });

      const result = await client.send(command);

      const folders = (result.CommonPrefixes || []).map((cp) => {
        const full = cp.Prefix || "";
        const name = full.replace(prefix, "").replace(/\/$/, "");
        const rel = full.replace(S3_PREFIX, "");
        return { name, prefix: rel };
      });

      const files = (result.Contents || [])
        .filter((obj) => {
          const key = obj.Key || "";
          // Exclude the prefix itself and .gitkeep
          return key !== prefix && !key.endsWith(".gitkeep");
        })
        .map((obj) => {
          const key = obj.Key || "";
          const relKey = key.replace(S3_PREFIX, "");
          const name = key.split("/").pop() || "";
          return {
            name,
            key: relKey,
            size: obj.Size || 0,
            lastModified: obj.LastModified?.toISOString() || "",
          };
        });

      return new Response(JSON.stringify({ folders, files }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "download") {
      const relPath = url.searchParams.get("path") || "";
      if (!relPath) {
        return new Response(JSON.stringify({ error: "Missing path" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const client = getS3Client();
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: S3_PREFIX + relPath,
      });

      // Generate presigned URL (valid for 15 minutes)
      const presignedUrl = await getSignedUrl(client, command, { expiresIn: 900 });

      return new Response(JSON.stringify({ url: presignedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "download-content") {
      // Direct download - used for report parsing
      const relPath = url.searchParams.get("path") || "";
      if (!relPath) {
        return new Response(JSON.stringify({ error: "Missing path" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const client = getS3Client();
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: S3_PREFIX + relPath,
      });

      const result = await client.send(command);
      const body = await result.Body?.transformToByteArray();

      if (!body) {
        return new Response(JSON.stringify({ error: "Empty file" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(body, {
        headers: {
          ...corsHeaders,
          "Content-Type": result.ContentType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${relPath.split("/").pop()}"`,
        },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use ?action=list|download|download-content" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("S3 TestSuite error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
