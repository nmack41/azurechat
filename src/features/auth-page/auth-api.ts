import NextAuth, { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import { Provider } from "next-auth/providers/index";
import { hashValue } from "./helpers";
import { image } from "@markdoc/markdoc/dist/src/schema";
import { access } from "fs";

const configureIdentityProvider = () => {
  const providers: Array<Provider> = [];

  const adminEmails = process.env.ADMIN_EMAIL_ADDRESS?.split(",").map((email) =>
    email.toLowerCase().trim()
  );

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: process.env.AUTH_GITHUB_ID!,
        clientSecret: process.env.AUTH_GITHUB_SECRET!,
        async profile(profile) {
          const image = await fetchProfilePicture(profile.avatar_url, null);
          const newProfile = {
            ...profile,
            isAdmin: adminEmails?.includes(profile.email.toLowerCase()),
            image: image,
          };
          // Profile created successfully
          return newProfile;
        },
      })
    );
  }

  if (
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
  ) {
    providers.push(
      AzureADProvider({
        clientId: process.env.AZURE_AD_CLIENT_ID!,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
        tenantId: process.env.AZURE_AD_TENANT_ID!,
        authorization: {
          params: {
            scope: "openid profile User.Read",
            prompt: "login",
            domain_hint: process.env.AZURE_AD_DOMAIN_HINT || "",
          },
        },
        async profile(profile, tokens) {
          const email = profile.email || profile.preferred_username || "";
          const image = await fetchProfilePicture(
            `https://graph.microsoft.com/v1.0/me/photos/48x48/$value`,
            tokens.access_token
          );
          const newProfile = {
            ...profile,
            email,
            id: profile.sub,
            isAdmin:
              adminEmails?.includes(profile.email?.toLowerCase()) ||
              adminEmails?.includes(profile.preferred_username?.toLowerCase()),
            image: image,
          };
          // Profile created successfully
          return newProfile;
        },
      })
    );
  }

  // If we're in local dev, add a basic credential provider option as well
  // (Useful when a dev doesn't have access to create app registration in their tenant)
  // This currently takes any username and makes a user with it, ignores password
  // Refer to: https://next-auth.js.org/configuration/providers/credentials
  if (process.env.NODE_ENV === "development") {
    providers.push(
      CredentialsProvider({
        name: "localdev",
        credentials: {
          username: { label: "Username", type: "text", placeholder: "dev" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials, req): Promise<any> {
          // Validate credentials even in dev mode to prevent authentication bypass
          if (!credentials?.username || !credentials?.password) {
            console.error("Dev auth: Missing username or password");
            return null;
          }

          // Simple dev mode validation - require password to match username
          // In production, this would connect to a real auth system
          if (credentials.password !== credentials.username) {
            console.error("Dev auth: Invalid credentials for", credentials.username);
            return null;
          }

          // Only allow specific dev users to prevent arbitrary access
          const allowedDevUsers = ["dev", "admin", "test"];
          if (!allowedDevUsers.includes(credentials.username)) {
            console.error("Dev auth: User not in allowed list:", credentials.username);
            return null;
          }

          const username = credentials.username;
          const email = username + "@localhost";
          const user = {
            id: hashValue(email),
            name: username,
            email: email,
            isAdmin: adminEmails?.includes(email) || username === "admin",
            image: "",
          };
          
          console.log("=== DEV USER AUTHENTICATED:", username);
          return user;
        },
      })
    );
  }

  return providers;
};

export const fetchProfilePicture = async (
  profilePictureUrl: string,
  accessToken: string | undefined
): Promise<string | null> => {
  console.log("Fetching profile picture...");
  var image = null;
  const profilePicture = await fetch(
    profilePictureUrl,
    accessToken && {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (profilePicture.ok) {
    console.log("Profile picture fetched successfully.");
    const pictureBuffer = await profilePicture.arrayBuffer();
    const pictureBase64 = Buffer.from(pictureBuffer).toString("base64");
    image = `data:image/jpeg;base64,${pictureBase64}`;
  } else {
    console.error(
      "Failed to fetch profile picture:",
      profilePictureUrl,
      profilePicture.statusText
    );
  }
  return image;
};

export const options: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [...configureIdentityProvider()],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.isAdmin) {
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    async session({ session, token, user }) {
      session.user.isAdmin = token.isAdmin as boolean;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
};

export const handlers = NextAuth(options);
