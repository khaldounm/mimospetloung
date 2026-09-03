// App-specific fields embedded in the Auth.js JWT and exposed on the session.
export interface AppUserFields {
  userId: number;
  roleName: string;
  permissions: string[];
  firstName: string;
  lastName: string;
  // Epoch ms of the sign-in that began this session, stamped once in the jwt
  // callback. Compared against the user's sessionsValidFrom to tell whether an
  // admin has signed this session out since. Optional because tokens minted
  // before this existed carry no stamp.
  signedInAt?: number;
}
