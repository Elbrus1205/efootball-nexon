import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware() {
    return;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (!token?.sub || token.isBanned) return false;
        if (req.nextUrl.pathname.startsWith("/admin")) {
          return (
            token.role === "FOUNDER" ||
            token.role === "ORGANIZER" ||
            token.role === "ADMIN" ||
            token.role === "JUDGE" ||
            token.role === "TRAINEE"
          );
        }
        return true;
      },
    },
    pages: {
      signIn: "/login",
    },
  },
);

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
