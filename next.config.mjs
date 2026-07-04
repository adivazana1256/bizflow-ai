/** @type {import('next').NextConfig} */
const nextConfig = {
  // @node-rs/argon2 is a native module; keep it out of the bundle.
  serverExternalPackages: ["@node-rs/argon2"],
};

export default nextConfig;
