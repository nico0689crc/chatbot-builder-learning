"use strict";
// shared/types/chatbot.types.ts
// Tipos del dominio compartidos entre todas las fases del proyecto.
// Estos tipos reflejan exactamente el modelo de datos del builder multi-tenant.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotivoEscalado = exports.TipoConector = exports.Canal = exports.Arquetipo = void 0;
// ─────────────────────────────────────────────
// ARQUETIPOS
// ─────────────────────────────────────────────
/**
 * Los 6 tipos de bot que el builder soporta.
 * Cada arquetipo tiene su propio grafo LangGraph,
 * su propio conjunto de tools y sus propios parámetros de IA.
 */
var Arquetipo;
(function (Arquetipo) {
    Arquetipo["FAQ"] = "faq";
    Arquetipo["TURNOS"] = "turnos";
    Arquetipo["VENTAS"] = "ventas";
    Arquetipo["SOPORTE"] = "soporte";
    Arquetipo["INTERNO"] = "interno";
    Arquetipo["TRANSACCIONAL"] = "transaccional";
})(Arquetipo || (exports.Arquetipo = Arquetipo = {}));
// ─────────────────────────────────────────────
// CANALES
// ─────────────────────────────────────────────
/** Los canales por donde el usuario puede contactar al bot */
var Canal;
(function (Canal) {
    Canal["WEB"] = "web";
    Canal["WHATSAPP"] = "whatsapp";
    Canal["INSTAGRAM"] = "instagram";
    Canal["API"] = "api";
})(Canal || (exports.Canal = Canal = {}));
// ─────────────────────────────────────────────
// FUNCTION CALLING — TOOLS
// ─────────────────────────────────────────────
/** Los tipos de conector que el executor universal puede resolver */
var TipoConector;
(function (TipoConector) {
    TipoConector["API_REST"] = "api_rest";
    TipoConector["GOOGLE_SHEETS"] = "google_sheets";
    TipoConector["BD_DIRECTA"] = "bd_directa";
    TipoConector["WEBHOOK"] = "webhook";
    TipoConector["CRM"] = "crm";
})(TipoConector || (exports.TipoConector = TipoConector = {}));
// ─────────────────────────────────────────────
// ESCALADO
// ─────────────────────────────────────────────
/** Razones por las que el bot puede escalar a un humano */
var MotivoEscalado;
(function (MotivoEscalado) {
    MotivoEscalado["NO_SABE_RESPONDER"] = "no_sabe_responder";
    MotivoEscalado["USUARIO_LO_PIDE"] = "usuario_lo_pide";
    MotivoEscalado["TEMA_SENSIBLE"] = "tema_sensible";
    MotivoEscalado["QUEJA_FORMAL"] = "queja_formal";
    MotivoEscalado["ERROR_SISTEMA"] = "error_sistema";
    MotivoEscalado["SUPERA_COMPLEJIDAD"] = "supera_complejidad";
})(MotivoEscalado || (exports.MotivoEscalado = MotivoEscalado = {}));
