const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const perguntas = JSON.parse(fs.readFileSync('./data/perguntas.json', 'utf-8'));

let estadoJogo = {
  iniciado: false,
  sala: null,
  maxJogadores: 6,
  jogadores: [],
  jogadorAtual: 0,
  perguntaAtual: null,
  historicoCasas: {},
  moderadorSocketId: null,
  jogadoresNaCasa102: 0 // ✅ NOVO: Contador de jogadores que chegaram na casa 102
};

function gerarCodigoSala() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getPergunta(casa, nomeJogador) {
  const esp = perguntas.find(p => p.Casa == casa && p.Jogador === nomeJogador);
  if (esp) return esp;
  const disp = perguntas.filter(p => p.Casa == casa);
  return disp.length ? disp[Math.floor(Math.random() * disp.length)] : null;
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

io.on('connection', (socket) => {
  console.log('Conectado:', socket.id);

  socket.on('criarSala', (num) => {
    estadoJogo = {
      iniciado: true,
      sala: gerarCodigoSala(),
      maxJogadores: num,
      jogadores: [],
      jogadorAtual: 0,
      perguntaAtual: null,
      historicoCasas: {},
      moderadorSocketId: socket.id,
      jogadoresNaCasa102: 0
    };
    socket.join('sala');
    console.log('Moderador criou sala:', estadoJogo.sala);
    io.emit('salaCriada', { codigo: estadoJogo.sala });
  });

  socket.on('entrarSala', ({ codigo, nome }) => {
    if (!estadoJogo.iniciado) return socket.emit('erro', 'Jogo não iniciado pelo moderador.');
    if (codigo !== estadoJogo.sala) return socket.emit('erro', 'Código incorreto.');
    if (estadoJogo.jogadores.length >= estadoJogo.maxJogadores) return socket.emit('erro', 'Sala cheia.');
    if (estadoJogo.jogadores.find(j => j.nome === nome)) return socket.emit('erro', 'Nome em uso.');

    const j = {
      id: estadoJogo.jogadores.length,
      nome,
      perguntaJogador: 'Jogador ' + (estadoJogo.jogadores.length + 1),
      casa: 0,
      acertos: 0,
      erros: 0,
      socketId: socket.id,
      chegouNa102: false // ✅ NOVO: Flag para saber se já chegou na casa 102
    };
    estadoJogo.jogadores.push(j);
    estadoJogo.historicoCasas[j.id] = [0];
    socket.join('sala');
    socket.emit('entradaOk', { jogadorId: j.id });
    io.to('sala').emit('jogadoresAtualizados', estadoJogo.jogadores);
    console.log(nome + ' entrou na sala. Total:', estadoJogo.jogadores.length);
  });

  socket.on('iniciarTurno', () => {
    if (!estadoJogo.jogadores.length) return;

    const j = estadoJogo.jogadores[estadoJogo.jogadorAtual];
    const dado = Math.floor(Math.random() * 6) + 1;
    let novaCasa = j.casa + dado;

    if (novaCasa > 102) novaCasa = 102;
    
    // ✅ NOVO: Se chegou na casa 102 pela primeira vez, incrementa contador
    if (novaCasa === 102 && !j.chegouNa102) {
      j.chegouNa102 = true;
      estadoJogo.jogadoresNaCasa102++;
    }
    
    j.casa = novaCasa;
    estadoJogo.historicoCasas[j.id].push(novaCasa);

    const p = getPergunta(novaCasa, j.perguntaJogador);
    estadoJogo.perguntaAtual = p;

    io.to('sala').emit('jogadoresAtualizados', estadoJogo.jogadores);
    io.to('sala').emit('turnoIniciado', {
      jogador: j.nome,
      jogadorId: j.id,
      dado,
      casa: novaCasa,
      pergunta: p ? { texto: p.PERGUNTAS } : null,
      semPergunta: !p
    });

    if (p && socket.id === estadoJogo.moderadorSocketId) {
      socket.emit('respostaSecreta', {
        resposta: p.RESPOSTAS,
        fonte: p.FONTE || '',
        link: p.LINK || ''
      });
    }
  });

  socket.on('julgamento', (acertou) => {
    const j = estadoJogo.jogadores[estadoJogo.jogadorAtual];
    const hist = estadoJogo.historicoCasas[j.id];

    if (acertou) {
      j.acertos++;
    } else {
      j.erros++;
      if (hist.length >= 2) {
        hist.pop();
        j.casa = hist[hist.length - 1] + 1;
        hist.push(j.casa);
      }
    }

    io.to('sala').emit('resultado', {
      acertou,
      resposta: estadoJogo.perguntaAtual ? estadoJogo.perguntaAtual.RESPOSTAS : null,
      fonte: estadoJogo.perguntaAtual ? (estadoJogo.perguntaAtual.FONTE || '') : '',
      link: estadoJogo.perguntaAtual ? (estadoJogo.perguntaAtual.LINK || '') : '',
      jogador: j.nome,
      casaFinal: j.casa
    });

    io.to('sala').emit('jogadoresAtualizados', estadoJogo.jogadores);

    // ✅ CORRIGIDO: Verificar se é fim de jogo
    // Condição: jogador está na casa 102 E é o penúltimo a chegar lá
    const isCasa102 = j.casa === 102;
    const totalJogadores = estadoJogo.jogadores.length;
    const jogadoresQueFaltam = totalJogadores - estadoJogo.jogadoresNaCasa102;

    // O jogo termina quando o penúltimo jogador chega na casa 102
    // Ou seja, quando falta apenas 1 jogador para chegar na casa 102
    if (isCasa102 && jogadoresQueFaltam === 1) {
      const ranking = [...estadoJogo.jogadores].sort((a, b) => {
        if (b.acertos !== a.acertos) return b.acertos - a.acertos;
        return a.erros - b.erros;
      });

      console.log('🏆 FIM DE JOGO! Ranking:', ranking);

      io.to('sala').emit('jogoFinalizado', {
        ranking: ranking.map(j => ({
          nome: j.nome,
          acertos: j.acertos,
          erros: j.erros
        }))
      });
    }
  });

  socket.on('proximoJogador', () => {
    estadoJogo.jogadorAtual = (estadoJogo.jogadorAtual + 1) % estadoJogo.jogadores.length;
    estadoJogo.perguntaAtual = null;
    io.to('sala').emit('proximoJogador', {
      jogador: estadoJogo.jogadores[estadoJogo.jogadorAtual].nome
    });
  });

  socket.on('encerrarJogo', () => {
    io.to('sala').emit('jogoEncerrado');
    estadoJogo = { iniciado: false, sala: null, jogadores: [], jogadorAtual: 0, moderadorSocketId: null };
  });

  socket.on('disconnect', () => {
    console.log('Desconectado:', socket.id);
    if (socket.id === estadoJogo.moderadorSocketId) {
      console.log('⚠️ Moderador desconectou!');
    }
  });
});

server.listen(3000, '0.0.0.0', () => console.log('🎲 Servidor em http://localhost:3000'));