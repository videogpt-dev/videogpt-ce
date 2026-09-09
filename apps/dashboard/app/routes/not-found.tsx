import { PageError } from "../../src/components/page-state";

export default function NotFound() {
  return <PageError message="That local Studio route does not exist." />;
}
