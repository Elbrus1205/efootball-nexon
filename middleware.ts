import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware() {
    return;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (!token) return false;
        if (req.nextUrl.pathname.startsWith("/admin")) {
          return token.role === "ADMIN" || token.role === "MODERATOR";
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
