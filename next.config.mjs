import withPWAInit from "next-pwa";

const pwaEnabled =
	process.env.NODE_ENV === "production" &&
	(process.env.ENABLE_PWA === "true" || process.env.CI === "true" || process.env.VERCEL === "1");

const withPWA = withPWAInit({
	dest: "public",
	disable: !pwaEnabled,
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withPWA(nextConfig);
