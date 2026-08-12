{
  description = "NodeBookingApi NestJS development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_24
            typescript
            typescript-language-server
            postgresql # psql client only; the server runs in Docker
          ];

          shellHook = ''
            echo "NodeBookingApi dev environment"
            echo "Node $(node --version) | npm $(npm --version)"
          '';
        };
      });
}
