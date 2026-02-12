import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.600.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.600.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "cateng";
const ROOT_PREFIX = "TEST_SUITE/";

function getS3Client() {
  return new S3Client({
    region: Deno.env.get("AWS_REGION") || "eu-west-1",
    credentials: {
      accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID") || "",
      secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY") || "",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";
    const prefix = url.searchParams.get("prefix") || ROOT_PREFIX;
    const s3 = getS3Client();

    if (action === "list") {
      // List folders and files at a given prefix
      const command = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        Delimiter: "/",
      });

      const result = await s3.send(command);

      const folders = (result.CommonPrefixes || []).map((p) => {
        const full = p.Prefix || "";
        const name = full.replace(prefix, "").replace(/\/$/, "");
        return { name, prefix: full };
      }).filter(f => f.name);

      const files = (result.Contents || []).filter(c => c.Key !== prefix).map((c) => ({
        name: (c.Key || "").replace(prefix, ""),
        key: c.Key || "",
        size: c.Size || 0,
        lastModified: c.LastModified?.toISOString() || "",
      }));

      return new Response(JSON.stringify({ folders, files }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "presign") {
      const key = url.searchParams.get("key");
      if (!key) {
        return new Response(JSON.stringify({ error: "Missing key param" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

      return new Response(JSON.stringify({ url: presignedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "put") {
      const key = url.searchParams.get("key");
      if (!key) {
        return new Response(JSON.stringify({ error: "Missing key param" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.text();
      const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: "application/json",
      });
      await s3.send(command);

      return new Response(JSON.stringify({ success: true, key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("S3 browser error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
