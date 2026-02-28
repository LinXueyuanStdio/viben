import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, Play, Pause } from "lucide-react";

type Position = { x: number; y: number };
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SPEED = 150;

export default function SnakeGame() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Direction>("RIGHT");
  const [nextDirection, setNextDirection] = useState<Direction>("RIGHT");
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState(INITIAL_SPEED);

  // Generate random food position
  const generateFood = useCallback((snakeBody: Position[]) => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (snakeBody.some((seg) => seg.x === newFood.x && seg.y === newFood.y));
    return newFood;
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    const initialSnake = [{ x: 10, y: 10 }];
    setSnake(initialSnake);
    setFood(generateFood(initialSnake));
    setDirection("RIGHT");
    setNextDirection("RIGHT");
    setScore(0);
    setGameOver(false);
    setSpeed(INITIAL_SPEED);
    setIsPlaying(false);
  }, [generateFood]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isPlaying && !gameOver && e.key.startsWith("Arrow")) {
        setIsPlaying(true);
      }

      switch (e.key) {
        case "ArrowUp":
          if (direction !== "DOWN") setNextDirection("UP");
          break;
        case "ArrowDown":
          if (direction !== "UP") setNextDirection("DOWN");
          break;
        case "ArrowLeft":
          if (direction !== "RIGHT") setNextDirection("LEFT");
          break;
        case "ArrowRight":
          if (direction !== "LEFT") setNextDirection("RIGHT");
          break;
        case " ":
          if (!gameOver) setIsPlaying((prev) => !prev);
          break;
        case "r":
        case "R":
          resetGame();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [direction, isPlaying, gameOver, resetGame]);

  // Game loop
  useEffect(() => {
    if (!isPlaying || gameOver) return;

    const gameInterval = setInterval(() => {
      setDirection(nextDirection);

      setSnake((prevSnake) => {
        const head = prevSnake[0];
        let newHead: Position;

        // Calculate new head position
        switch (nextDirection) {
          case "UP":
            newHead = { x: head.x, y: head.y - 1 };
            break;
          case "DOWN":
            newHead = { x: head.x, y: head.y + 1 };
            break;
          case "LEFT":
            newHead = { x: head.x - 1, y: head.y };
            break;
          case "RIGHT":
            newHead = { x: head.x + 1, y: head.y };
            break;
        }

        // Check wall collision
        if (
          newHead.x < 0 ||
          newHead.x >= GRID_SIZE ||
          newHead.y < 0 ||
          newHead.y >= GRID_SIZE
        ) {
          setGameOver(true);
          setIsPlaying(false);
          return prevSnake;
        }

        // Check self collision
        if (prevSnake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
          setGameOver(true);
          setIsPlaying(false);
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        // Check food collision
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore((prev) => prev + 10);
          setFood(generateFood(newSnake));
          // Increase speed every 5 foods
          if ((score + 10) % 50 === 0) {
            setSpeed((prev) => Math.max(50, prev - 10));
          }
          return newSnake;
        }

        // Remove tail if no food eaten
        newSnake.pop();
        return newSnake;
      });
    }, speed);

    return () => clearInterval(gameInterval);
  }, [isPlaying, gameOver, nextDirection, food, score, speed, generateFood]);

  // Draw game on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "oklch(0.985 0.002 75)"; // neutral-50 from design system
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "oklch(0.92 0.004 75)"; // neutral-200
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw snake with gradient (warm amber)
    snake.forEach((segment, index) => {
      const alpha = 1 - index * 0.02; // Fade tail
      ctx.fillStyle = `oklch(0.70 0.18 75 / ${Math.max(0.4, alpha)})`; // brand-amber-500
      ctx.fillRect(
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2
      );

      // Draw eyes on head
      if (index === 0) {
        ctx.fillStyle = "oklch(0.15 0.004 75)"; // neutral-900
        const eyeSize = 3;
        const eyeOffset = 6;

        if (direction === "UP" || direction === "DOWN") {
          ctx.fillRect(
            segment.x * CELL_SIZE + eyeOffset,
            segment.y * CELL_SIZE + CELL_SIZE / 2 - eyeSize / 2,
            eyeSize,
            eyeSize
          );
          ctx.fillRect(
            segment.x * CELL_SIZE + CELL_SIZE - eyeOffset - eyeSize,
            segment.y * CELL_SIZE + CELL_SIZE / 2 - eyeSize / 2,
            eyeSize,
            eyeSize
          );
        } else {
          ctx.fillRect(
            segment.x * CELL_SIZE + CELL_SIZE / 2 - eyeSize / 2,
            segment.y * CELL_SIZE + eyeOffset,
            eyeSize,
            eyeSize
          );
          ctx.fillRect(
            segment.x * CELL_SIZE + CELL_SIZE / 2 - eyeSize / 2,
            segment.y * CELL_SIZE + CELL_SIZE - eyeOffset - eyeSize,
            eyeSize,
            eyeSize
          );
        }
      }
    });

    // Draw food (teal accent with glow)
    ctx.shadowBlur = 10;
    ctx.shadowColor = "oklch(0.65 0.14 195 / 0.5)"; // brand-teal-500
    ctx.fillStyle = "oklch(0.65 0.14 195)"; // brand-teal-500
    ctx.beginPath();
    ctx.arc(
      food.x * CELL_SIZE + CELL_SIZE / 2,
      food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [snake, food, direction]);

  const handleDirectionClick = (newDirection: Direction) => {
    if (!isPlaying && !gameOver) {
      setIsPlaying(true);
    }

    if (
      (direction === "UP" && newDirection !== "DOWN") ||
      (direction === "DOWN" && newDirection !== "UP") ||
      (direction === "LEFT" && newDirection !== "RIGHT") ||
      (direction === "RIGHT" && newDirection !== "LEFT")
    ) {
      setNextDirection(newDirection);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-3xl text-center">
            {t("snakeGame.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Game Stats */}
          <div className="flex justify-between items-center">
            <div className="text-lg">
              <span className="font-semibold text-[oklch(0.70_0.18_75)]">{t("snakeGame.score")}</span>{" "}
              <span className="font-mono font-bold text-xl">{score}</span>
            </div>
            <div className="text-lg">
              <span className="font-semibold text-[oklch(0.70_0.18_75)]">{t("snakeGame.length")}</span>{" "}
              <span className="font-mono font-bold text-xl">{snake.length}</span>
            </div>
            <div className="text-lg">
              <span className="font-semibold text-[oklch(0.70_0.18_75)]">{t("snakeGame.speed")}</span>{" "}
              <span className="font-mono font-bold text-xl">
                {Math.round((INITIAL_SPEED - speed) / 10)}
              </span>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex justify-center">
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={GRID_SIZE * CELL_SIZE}
                height={GRID_SIZE * CELL_SIZE}
                className="border-2 border-[oklch(0.70_0.18_75)] rounded-lg shadow-lg"
              />
              {gameOver && (
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <p className="text-white font-serif text-3xl font-bold">{t("snakeGame.gameOver")}</p>
                    <p className="text-white text-xl">
                      {t("snakeGame.finalScore", { score })}
                    </p>
                    <Button
                      onClick={resetGame}
                      className="bg-[oklch(0.70_0.18_75)] hover:bg-[oklch(0.62_0.18_75)]"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      {t("snakeGame.restart")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="flex justify-center gap-4">
              <Button
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={gameOver}
                variant="outline"
                size="lg"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    {t("snakeGame.pause")}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    {t("snakeGame.start")}
                  </>
                )}
              </Button>
              <Button onClick={resetGame} variant="outline" size="lg">
                <RotateCcw className="w-4 h-4 mr-2" />
                {t("snakeGame.reset")}
              </Button>
            </div>

            {/* Direction buttons */}
            <div className="flex flex-col items-center gap-2">
              <Button
                onClick={() => handleDirectionClick("UP")}
                disabled={gameOver}
                variant="outline"
                size="icon"
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleDirectionClick("LEFT")}
                  disabled={gameOver}
                  variant="outline"
                  size="icon"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDirectionClick("DOWN")}
                  disabled={gameOver}
                  variant="outline"
                  size="icon"
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDirectionClick("RIGHT")}
                  disabled={gameOver}
                  variant="outline"
                  size="icon"
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <Card className="bg-[oklch(0.985_0.002_75)]">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2 text-[oklch(0.70_0.18_75)]">{t("snakeGame.instructions")}</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• {t("snakeGame.instruction1")}</li>
                <li>• {t("snakeGame.instruction2")}</li>
                <li>• {t("snakeGame.instruction3")}</li>
                <li>• {t("snakeGame.instruction4")}</li>
                <li>• {t("snakeGame.instruction5")}</li>
              </ul>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
