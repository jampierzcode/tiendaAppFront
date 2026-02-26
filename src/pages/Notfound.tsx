import { type JSX } from "react";
import { Link } from "react-router-dom";

const Notfound = (): JSX.Element => {
  return (
    <>
      <div>Notfound</div>
      <Link to={"/login"}>Ir al inicio</Link>
    </>
  );
};

export default Notfound;
