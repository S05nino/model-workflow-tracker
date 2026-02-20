import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { LambdaClient, InvokeCommand } from "npm:@aws-sdk/client-lambda@3.600.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const region = Deno.env.get("AWS_REGION");
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const functionName = Deno.env.get("AWS_LAMBDA_FUNCTION_NAME");

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error("AWS credentials not configured");
    }
    if (!functionName) {
      throw new Error("AWS_LAMBDA_FUNCTION_NAME not configured");
    }

    const { config } = await req.json();
    if (!config) {
      return new Response(JSON.stringify({ error: "Missing config in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = new LambdaClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    // Invoke Lambda asynchronously (InvocationType: Event) so we don't wait for it
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "Event", // async - returns immediately
      Payload: new TextEncoder().encode(JSON.stringify(config)),
    });

    const result = await client.send(command);

    return new Response(
      JSON.stringify({
        ok: true,
        statusCode: result.StatusCode,
        message: "Test execution triggered successfully. Results will appear in the output folder on S3.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Run TestSuite error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
