/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [new URL('https://github.com/**')],
    },
    reactStrictMode: false,
};

export default nextConfig;
