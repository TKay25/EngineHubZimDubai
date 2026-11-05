import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Brand() {
  const { companyName } = useAuth();
  return (
    <Link to="/" className="brand" aria-label={`${companyName} home`}>
      <img src="/static/brand/logo.svg" alt={companyName} />
    </Link>
  );
}
