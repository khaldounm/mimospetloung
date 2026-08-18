// App-specific fields embedded in the Auth.js JWT and exposed on the session.
export interface AppUserFields {
  userId: number;
  roleName: string;
  permissions: string[];
  firstName: string;
  lastName: string;
}
