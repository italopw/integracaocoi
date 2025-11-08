// Arquivo: js/integracao.js
// Módulo exportado do script que estava inline em integracao.html

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

let db, auth;
let isAuthReady = false;

// Inicialização e Autenticação Firebase
export async function initializeFirebaseDashboard() {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    try {
        await signInAnonymously(auth);
        console.log("✅ Autenticação Firebase bem-sucedida.");
    } catch (error) {
        console.error("❌ Falha na autenticação Firebase:", error);
    }
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log(`Usuário autenticado: ${user.uid}`);
            isAuthReady = true;
            listenToPlanningData(); // Começa a escutar após a autenticação
        } else {
            console.log("Usuário desautenticado.");
            document.getElementById('status-conexao').textContent = "DESCONECTADO";
            document.getElementById('status-conexao').className = 'text-red-500 font-bold';
        }
    });
}

// Obtém a referência do documento público
function getPlanningDocRef() {
    return doc(db, 'public/planning_data/current_status');
}

// Função para escutar mudanças nos dados do planejamento (Firestore ou fallback localStorage)
function listenToPlanningData() {
    const statusIndicator = document.getElementById('status-conexao');

    if (db && isAuthReady) {
        try {
            const docRef = getPlanningDocRef();
            // onSnapshot: Atualiza em tempo real sempre que os dados mudam no Firestore
            onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    statusIndicator.textContent = "CONECTADO: Dados atualizados.";
                    statusIndicator.className = 'text-green-500 font-bold';
                    updateDashboard(data);
                } else {
                    statusIndicator.textContent = "CONECTADO: Aguardando primeira transmissão...";
                    statusIndicator.className = 'text-yellow-500 font-bold';
                    document.getElementById('dashboard-content').innerHTML = '<p class="text-center text-gray-500 p-8">Nenhum dado de planejamento encontrado. Por favor, utilize a Interface de Entrada (A) para transmitir o primeiro status operacional.</p>';
                }
            }, (error) => {
                console.error("Erro ao escutar dados do Firestore:", error);
                statusIndicator.textContent = "ERRO: Falha na conexão Firestore.";
                statusIndicator.className = 'text-red-500 font-bold';
            });
        } catch (e) {
            console.error('Erro ao configurar listener Firestore:', e);
            statusIndicator.textContent = "ERRO: Falha ao configurar conexão.";
            statusIndicator.className = 'text-red-500 font-bold';
        }
    }
}



// Mapeia prioridades para classes Tailwind (para cores)
function getPriorityClass(priority) {
    if (!priority) return 'priority-normal bg-white';
    
    // Normaliza removendo acentos e convertendo para minúsculo
    const normalizedPriority = priority
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    
    switch (normalizedPriority) {
        case 'alta': return 'priority-alta bg-white';
        case 'media': return 'priority-media bg-white';
        case 'baixa': return 'priority-baixa bg-white';
        case 'normal': return 'priority-normal bg-white';
        default: return 'priority-normal bg-white';
}

// Função principal para atualizar o Dashboard com novos dados
export function updateDashboard(data) {
    const contentContainer = document.getElementById('dashboard-content');
    
    // 1. Atualizar Header
    if (document.getElementById('data-planejamento')) document.getElementById('data-planejamento').textContent = data.data || 'N/A';
    if (document.getElementById('turno-planejamento')) document.getElementById('turno-planejamento').textContent = data.turno || 'N/A';
    if (document.getElementById('ultima-atualizacao')) document.getElementById('ultima-atualizacao').textContent = new Date(data.timestamp).toLocaleString('pt-BR') || 'N/A';
    
    // 2. Processar e Ordenar Setores
    const setores = data.setores || [];

    // A alta gestão sempre visualiza a prioridade mais alta primeiro
    const orderMap = { 'ALTA': 1, 'MÉDIA': 2, 'BAIXA': 3, 'NORMAL': 4 };
    setores.sort((a, b) => {
        const priorityA = orderMap[(a.prioridade || '').toUpperCase()] || 99;
        const priorityB = orderMap[(b.prioridade || '').toUpperCase()] || 99;
        return priorityA - priorityB;
    });

    // 3. Renderizar Setores
    let htmlContent = '';
    setores.forEach(setor => {
        htmlContent += `
            <div class="card p-6 ${getPriorityClass(setor.prioridade)}">
                <div class="status-header flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold text-[#0d2545]">${setor.nome}</h3>
                    <span class="text-lg font-bold">
                        Prioridade: ${String(setor.prioridade || '').toUpperCase()}
                    </span>
                </div>
                <p class="whitespace-pre-wrap text-gray-700 leading-relaxed min-h-[100px]">${setor.status}</p>
            </div>
        `;
    });

    if (contentContainer) contentContainer.innerHTML = htmlContent;
}

// Inicia o processo automaticamente ao importar
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        initializeFirebaseDashboard();
    });
}
