/**
 * Represents a group in the grouped list view.
 */
export interface ListGroup {
  /** Unique identifier for the group */
  id: string;
  /** Display name of the group */
  name: string;
  /** Color for the group indicator (CSS color value) */
  color: string;
  /** Number of items in the group */
  count: number;
}
