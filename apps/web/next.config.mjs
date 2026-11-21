/** @type {import('next').NextConfig} */
if (process.env.NODE_ENV === "production") {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("Set NEXT_PUBLIC_API_URL to the public HTTPS URL of the deployed Civic Lens API before building for production.");
  }

  let parsedApiUrl;
  try {
    parsedApiUrl = new URL(apiUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be a valid public HTTPS URL.");
  }

  if (
    parsedApiUrl.protocol !== "https:" ||
    ["localhost", "127.0.0.1", "::1"].includes(parsedApiUrl.hostname)
  ) {
    throw new Error("NEXT_PUBLIC_API_URL must be a public HTTPS URL, not localhost.");
  }
}

const nextConfig = {
  images: { unoptimized: true },
};
export default nextConfig;
