/** Thrown when user cancels an approval dialog */
export class UserCancelledException extends Error {
  constructor(message = "User cancelled the action") {
    super(message);
    this.name = "UserCancelledException";
  }
}
