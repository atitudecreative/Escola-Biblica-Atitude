-- AlterTable
ALTER TABLE "courses" ALTER COLUMN "sequential" SET DEFAULT true;

-- AlterTable
ALTER TABLE "progress" ADD COLUMN     "lastBeatAt" TIMESTAMP(3),
ADD COLUMN     "mediaSeconds" INTEGER,
ADD COLUMN     "watchedSegments" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- Progressão sequencial passa a ser o padrão da Escola: aula seguinte só após concluir a anterior.
UPDATE "courses" SET "sequential" = true WHERE "sequential" = false;
