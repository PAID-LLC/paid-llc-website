export const runtime = "edge";

export async function GET(req: Request) {
  return Response.redirect(new URL("/agent.json", req.url), 301);
}
