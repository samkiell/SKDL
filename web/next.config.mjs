/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ['@ffmpeg-installer/ffmpeg', 'fluent-ffmpeg']
    }
};

export default nextConfig;
