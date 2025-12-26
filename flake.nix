{
  description = "Starship HUD development environment";

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
            # Python
            python312
            uv

            # Node.js
            nodejs_20
            nodePackages.npm

            # Tools
            just
            sqlite
            jq
            curl
            httpie

            # Docker (for local testing)
            docker
            docker-compose
          ];

          shellHook = ''
            echo "Starship HUD Development Environment"
            echo "====================================="
            echo ""
            echo "Commands:"
            echo "  just dev      - Start all development servers"
            echo "  just backend  - Start backend only"
            echo "  just frontend - Start frontend only"
            echo "  just test     - Run all tests"
            echo "  just db-reset - Reset database with seed data"
            echo ""

            # Set up Python virtual environment path
            export VIRTUAL_ENV="$PWD/.venv"
            export PATH="$VIRTUAL_ENV/bin:$PATH"

            # Frontend node_modules binaries
            export PATH="$PWD/frontend/node_modules/.bin:$PATH"
          '';
        };
      }
    );
}
