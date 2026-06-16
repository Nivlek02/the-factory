interface BoardProtectedRouteProps {
  children: React.ReactNode;
}

const BoardProtectedRoute = ({ children }: BoardProtectedRouteProps) => {
  return <>{children}</>;
};

export default BoardProtectedRoute;
