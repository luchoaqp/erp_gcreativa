-- Esquema del ERP Genia Creativa (idéntico al del backend Node v2.4)
-- Generado desde la base dev_tienda_regalos. Lo usa la migración 'esquema_inicial'.
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `agencias_envio` (
  `id` int NOT NULL AUTO_INCREMENT,
  `courier_id` int NOT NULL,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `departamento` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provincia` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `distrito` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referencia` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefono` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contacto` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `horario` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notas` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ag_courier` (`courier_id`),
  KEY `idx_ag_depto` (`departamento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `catalogos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ocasion` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `descripcion` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `links_json` mediumtext COLLATE utf8mb4_unicode_ci,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_catalogos_ocasion` (`ocasion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categorias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci,
  `icono` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `color_badge` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '#FF6B35',
  `estado` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `clientes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefono` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion_frecuente` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_especial` date DEFAULT NULL,
  `tipo_fecha_especial` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notas` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `tipo_documento` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DNI',
  `numero_documento` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `departamento` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provincia` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT '1',
  `tipo_cliente_id` int DEFAULT NULL,
  `direcciones_extra` text COLLATE utf8mb4_unicode_ci,
  `telefonos_extra` text COLLATE utf8mb4_unicode_ci,
  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cliente_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `compra_detalles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `compra_id` int NOT NULL,
  `producto_id` int DEFAULT NULL,
  `codigo` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cantidad` decimal(10,2) NOT NULL DEFAULT '1.00',
  `precio_base` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `afectacion` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'gravado',
  `descuento` decimal(10,2) NOT NULL DEFAULT '0.00',
  `igv` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `lote_codigo` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cd_compra` (`compra_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `compras` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipo_comprobante` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'sin_comprobante',
  `serie` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correlativo` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_emision` date NOT NULL,
  `proveedor_id` int DEFAULT NULL,
  `proveedor_nombre` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proveedor_documento` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `almacen` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ALMACÉN PRINCIPAL',
  `motivo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'abastecimiento',
  `ingreso_almacen` tinyint(1) NOT NULL DEFAULT '1',
  `stock_ingresado` tinyint(1) NOT NULL DEFAULT '0',
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  `referencia` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guia_remision` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `descuento_global` decimal(10,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
  `igv` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `monto_pagado` decimal(12,2) NOT NULL DEFAULT '0.00',
  `estado` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'registrada',
  `usuario_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `moneda` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PEN',
  `tipo_cambio` decimal(10,4) DEFAULT NULL,
  `total_moneda` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_compras_fecha` (`fecha_emision`),
  KEY `idx_compras_prov` (`proveedor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `comprobantes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pedido_id` int NOT NULL,
  `tipo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `serie` varchar(6) COLLATE utf8mb4_unicode_ci NOT NULL,
  `numero` int NOT NULL,
  `doc_tipo` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doc_numero` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `razon_social` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha` datetime DEFAULT CURRENT_TIMESTAMP,
  `estado` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'emitido',
  `usuario_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_comprobante` (`serie`,`numero`),
  KEY `idx_comp_pedido` (`pedido_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `configuracion` (
  `id` int NOT NULL,
  `nombre_tienda` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Regalos Mágicos & Sorpresas',
  `ruc` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT '20608945123',
  `slogan` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT 'Momentos inolvidables que llegan al corazón',
  `telefono_whatsapp` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT '+51 987 654 321',
  `telefono_fijo` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT '(01) 456-7890',
  `email_contacto` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'contacto@regalodeensueno.com',
  `direccion` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT 'Av. Las Flores 450, Centro',
  `horario_atencion` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT 'Lunes a Sábado: 8:00 AM - 8:00 PM',
  `logo_url` mediumtext COLLATE utf8mb4_unicode_ci,
  `moneda_simbolo` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'S/.',
  `moneda_codigo` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'PEN',
  `separador_decimales` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT '.',
  `separador_miles` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT ',',
  `costo_delivery_base` decimal(10,2) DEFAULT '12.00',
  `zonas_reparto` text COLLATE utf8mb4_unicode_ci,
  `mensaje_whatsapp_plantilla` text COLLATE utf8mb4_unicode_ci,
  `pie_ticket` text COLLATE utf8mb4_unicode_ci,
  `color_principal` varchar(9) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sidebar_bg` varchar(9) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sidebar_texto` varchar(9) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sidebar_activo_bg` varchar(9) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sidebar_activo_texto` varchar(9) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cotizacion_config` (
  `id` int NOT NULL,
  `titulo_documento` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'COTIZACIÓN',
  `color_acento` varchar(9) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#FF5E36',
  `igv_porcentaje` decimal(5,2) NOT NULL DEFAULT '18.00',
  `aplicar_igv_defecto` tinyint(1) NOT NULL DEFAULT '0',
  `mostrar_igv_defecto` tinyint(1) NOT NULL DEFAULT '1',
  `vigencia_dias_defecto` int NOT NULL DEFAULT '7',
  `nota_defecto` text COLLATE utf8mb4_unicode_ci,
  `pie_pagina` text COLLATE utf8mb4_unicode_ci,
  `mostrar_qr` tinyint(1) NOT NULL DEFAULT '0',
  `qr_imagen` longtext COLLATE utf8mb4_unicode_ci,
  `qr_titulo` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Paga con Yape',
  `qr_detalle` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `formato_defecto` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'a4',
  `mostrar_terminos` tinyint(1) NOT NULL DEFAULT '1',
  `adelanto_tipo_defecto` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'porcentaje',
  `adelanto_valor_defecto` decimal(10,2) NOT NULL DEFAULT '50.00',
  `doc_razon_social` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doc_ruc` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doc_direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doc_telefono` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doc_email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doc_web` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doc_color_nombre` varchar(9) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doc_mostrar_logo` tinyint(1) NOT NULL DEFAULT '1',
  `doc_mostrar_ruc` tinyint(1) NOT NULL DEFAULT '1',
  `doc_mostrar_direccion` tinyint(1) NOT NULL DEFAULT '1',
  `doc_mostrar_telefono` tinyint(1) NOT NULL DEFAULT '1',
  `doc_mostrar_email` tinyint(1) NOT NULL DEFAULT '0',
  `doc_mostrar_web` tinyint(1) NOT NULL DEFAULT '0',
  `doc_mostrar_atendido` tinyint(1) NOT NULL DEFAULT '1',
  `doc_mostrar_cliente_doc` tinyint(1) NOT NULL DEFAULT '1',
  `doc_mostrar_cliente_tel` tinyint(1) NOT NULL DEFAULT '1',
  `doc_mostrar_codigo` tinyint(1) NOT NULL DEFAULT '1',
  `doc_mostrar_vigencia` tinyint(1) NOT NULL DEFAULT '1',
  `atendido_etiqueta` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Atendido por',
  `atendido_modo` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usuario',
  `atendido_texto` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cotizacion_detalles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cotizacion_id` int NOT NULL,
  `producto_id` int DEFAULT NULL,
  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cantidad` int NOT NULL DEFAULT '1',
  `precio_unitario` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `cotizacion_id` (`cotizacion_id`),
  CONSTRAINT `cotizacion_detalles_ibfk_1` FOREIGN KEY (`cotizacion_id`) REFERENCES `cotizaciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cotizaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `numero` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cliente_id` int DEFAULT NULL,
  `cliente_nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Cliente Varios',
  `cliente_telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cliente_documento` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `usuario_id` int DEFAULT NULL,
  `fecha` datetime DEFAULT CURRENT_TIMESTAMP,
  `vigencia_dias` int NOT NULL DEFAULT '7',
  `fecha_vencimiento` date NOT NULL,
  `aplicar_igv` tinyint(1) NOT NULL DEFAULT '0',
  `mostrar_igv` tinyint(1) NOT NULL DEFAULT '1',
  `igv_porcentaje` decimal(5,2) NOT NULL DEFAULT '18.00',
  `costo_envio` decimal(10,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  `igv_monto` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `nota` text COLLATE utf8mb4_unicode_ci,
  `estado` enum('vigente','aceptada','anulada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'vigente',
  `pedido_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cargos_json` text COLLATE utf8mb4_unicode_ci,
  `mostrar_terminos` tinyint(1) NOT NULL DEFAULT '1',
  `adelanto_tipo` varchar(12) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adelanto_valor` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero` (`numero`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `couriers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notas` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_courier_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gasto_detalles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `gasto_id` int NOT NULL,
  `descripcion` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `importe` decimal(12,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `idx_gd_gasto` (`gasto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gasto_pagos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `gasto_id` int NOT NULL,
  `metodo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'efectivo',
  `origen` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referencia` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `monto` decimal(12,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `idx_gp_gasto` (`gasto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gastos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proveedor_id` int DEFAULT NULL,
  `proveedor_nombre` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proveedor_documento` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `motivo` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'varios',
  `tipo_comprobante` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'sin_comprobante',
  `serie` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correlativo` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_emision` date NOT NULL,
  `moneda` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PEN',
  `tipo_cambio` decimal(10,4) DEFAULT NULL,
  `total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_moneda` decimal(12,2) DEFAULT NULL,
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  `estado` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'registrado',
  `usuario_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gastos_fecha` (`fecha_emision`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `kardex_movimientos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `producto_id` int NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tipo` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `motivo` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `documento` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cantidad` int NOT NULL,
  `costo_unit` decimal(12,2) NOT NULL DEFAULT '0.00',
  `stock_despues` int DEFAULT NULL,
  `almacen` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ALMACÉN PRINCIPAL',
  `ref_tipo` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ref_id` int DEFAULT NULL,
  `usuario_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_kx_producto` (`producto_id`,`fecha`),
  KEY `idx_kx_fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `marcas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `migraciones_aplicadas` (
  `clave` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `aplicada_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ocasiones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icono` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pagos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pedido_id` int NOT NULL,
  `fecha` date NOT NULL,
  `metodo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'efectivo',
  `destino` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referencia` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `monto` decimal(10,2) NOT NULL,
  `concepto` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'abono',
  `comprobante_url` longtext COLLATE utf8mb4_unicode_ci,
  `usuario_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pagos_pedido` (`pedido_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pedido_detalles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pedido_id` int NOT NULL,
  `producto_id` int NOT NULL,
  `cantidad` int NOT NULL DEFAULT '1',
  `precio_unitario` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `detalles_personalizacion` text COLLATE utf8mb4_unicode_ci,
  `descuento` decimal(10,2) NOT NULL DEFAULT '0.00',
  `proveedor_id` int DEFAULT NULL,
  `lote_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pedido_id` (`pedido_id`),
  KEY `producto_id` (`producto_id`),
  CONSTRAINT `pedido_detalles_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pedido_detalles_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pedido_diseno` (
  `pedido_id` int NOT NULL,
  `link` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto` mediumtext COLLATE utf8mb4_unicode_ci,
  `actualizado` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `links_json` mediumtext COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`pedido_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pedido_guias` (
  `pedido_id` int NOT NULL,
  `numero` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto` mediumtext COLLATE utf8mb4_unicode_ci,
  `actualizado` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pedido_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pedidos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `numero_pedido` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cliente_id` int DEFAULT NULL,
  `usuario_id` int DEFAULT NULL,
  `fecha_pedido` datetime DEFAULT CURRENT_TIMESTAMP,
  `fecha_entrega` date DEFAULT NULL,
  `franja_horaria` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre_destinatario` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefono_destinatario` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion_entrega` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `referencia_entrega` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mensaje_dedicatoria` text COLLATE utf8mb4_unicode_ci,
  `de_parte_de` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipo_entrega` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'tienda',
  `costo_envio` decimal(10,2) DEFAULT '0.00',
  `subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `metodo_pago` enum('efectivo','tarjeta','yape','plin','transferencia') COLLATE utf8mb4_unicode_ci DEFAULT 'yape',
  `estado_pago` enum('pagado','pendiente','adelanto') COLLATE utf8mb4_unicode_ci DEFAULT 'pagado',
  `estado_pedido` enum('pendiente_diseno','pendiente_aprobacion','en_produccion','listo','en_ruta','entregado','cancelado') COLLATE utf8mb4_unicode_ci DEFAULT 'pendiente_diseno',
  `repartidor_id` int DEFAULT NULL,
  `notas_taller` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aplica_igv` tinyint(1) NOT NULL DEFAULT '0',
  `igv_porcentaje` decimal(5,2) NOT NULL DEFAULT '0.00',
  `igv_monto` decimal(10,2) NOT NULL DEFAULT '0.00',
  `foto_entrega_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cliente_documento` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cliente_nombre` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `descuento_global` decimal(10,2) NOT NULL DEFAULT '0.00',
  `comprobante_borrador` text COLLATE utf8mb4_unicode_ci,
  `ciudad_envio` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cargos_json` text COLLATE utf8mb4_unicode_ci,
  `stock_descontado` tinyint(1) NOT NULL DEFAULT '0',
  `fecha_entrega_diseno` date DEFAULT NULL,
  `envio_datos` tinyint(1) NOT NULL DEFAULT '0',
  `envio_dest_doc_tipo` varchar(3) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `envio_origen` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `envio_destino` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `envio_dest_nombre` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `envio_dest_doc` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `envio_dest_telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_pedido` (`numero_pedido`),
  KEY `cliente_id` (`cliente_id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `repartidor_id` (`repartidor_id`),
  CONSTRAINT `pedidos_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `pedidos_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `pedidos_ibfk_3` FOREIGN KEY (`repartidor_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `producto_categorias` (
  `producto_id` int NOT NULL,
  `categoria_id` int NOT NULL,
  PRIMARY KEY (`producto_id`,`categoria_id`),
  KEY `idx_pc_categoria` (`categoria_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `producto_componentes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `producto_id` int NOT NULL,
  `componente_id` int NOT NULL,
  `cantidad` decimal(10,2) NOT NULL DEFAULT '1.00',
  `precio_unit` decimal(10,2) NOT NULL DEFAULT '0.00',
  `precio_ref` decimal(10,2) NOT NULL DEFAULT '0.00',
  `costo_ref` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `idx_pc_prod` (`producto_id`),
  KEY `idx_pc_comp` (`componente_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `producto_lotes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `producto_id` int NOT NULL,
  `proveedor_id` int NOT NULL DEFAULT '0',
  `compra_id` int DEFAULT NULL,
  `codigo` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_compra` date DEFAULT NULL,
  `cantidad_inicial` int NOT NULL DEFAULT '0',
  `stock` int NOT NULL DEFAULT '0',
  `costo_unit` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `estado` tinyint(1) NOT NULL DEFAULT '1',
  `nota` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lote_prod` (`producto_id`,`estado`,`stock`),
  KEY `idx_lote_compra` (`compra_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `producto_presentaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `producto_id` int NOT NULL,
  `etiqueta` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `factor` int NOT NULL DEFAULT '1',
  `precio` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `idx_pp_prod` (`producto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `producto_proveedor_stock` (
  `producto_id` int NOT NULL,
  `proveedor_id` int NOT NULL DEFAULT '0',
  `stock` int NOT NULL DEFAULT '0',
  `costo_unit` decimal(12,4) NOT NULL DEFAULT '0.0000',
  PRIMARY KEY (`producto_id`,`proveedor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `productos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci,
  `categoria_id` int DEFAULT NULL,
  `ocasion_id` int DEFAULT NULL,
  `precio_costo` decimal(10,2) NOT NULL DEFAULT '0.00',
  `precio_venta` decimal(10,2) NOT NULL,
  `stock` int NOT NULL DEFAULT '0',
  `stock_minimo` int NOT NULL DEFAULT '5',
  `imagen_url` mediumtext COLLATE utf8mb4_unicode_ci,
  `es_personalizable` tinyint(1) DEFAULT '0',
  `destacado` tinyint(1) DEFAULT '0',
  `activo` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `unidad` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NIU',
  `moneda` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PEN',
  `marca_id` int DEFAULT NULL,
  `codigo_barras` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nombre_secundario` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `modelo` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `linea` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `codigo_fabrica` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `precio_editable` tinyint(1) NOT NULL DEFAULT '1',
  `precio_por_cantidad` tinyint(1) NOT NULL DEFAULT '0',
  `proveedor_id` int DEFAULT NULL,
  `ganancia_pct` decimal(6,2) DEFAULT NULL,
  `calcular_con_ganancia` tinyint(1) NOT NULL DEFAULT '0',
  `requiere_insumos` tinyint(1) NOT NULL DEFAULT '0',
  `es_insumo` tinyint(1) NOT NULL DEFAULT '0',
  `precio_insumo` decimal(10,2) DEFAULT NULL,
  `es_pack` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `categoria_id` (`categoria_id`),
  KEY `ocasion_id` (`ocasion_id`),
  CONSTRAINT `productos_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON DELETE SET NULL,
  CONSTRAINT `productos_ibfk_2` FOREIGN KEY (`ocasion_id`) REFERENCES `ocasiones` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proveedores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo_documento` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'RUC',
  `numero_documento` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `departamento` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provincia` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contacto` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notas` text COLLATE utf8mb4_unicode_ci,
  `estado` tinyint(1) NOT NULL DEFAULT '1',
  `direcciones_extra` text COLLATE utf8mb4_unicode_ci,
  `telefonos_extra` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_proveedor_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `taller_maquinas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `categoria` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'otro',
  `marca` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `modelo` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `serie` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_compra` date DEFAULT NULL,
  `precio_compra` decimal(12,2) DEFAULT NULL,
  `proveedor` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_ultimo_mantenimiento` date DEFAULT NULL,
  `mantenimiento_cada_dias` int DEFAULT NULL,
  `estado` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'operativa',
  `caracteristicas` mediumtext COLLATE utf8mb4_unicode_ci,
  `insumos_json` mediumtext COLLATE utf8mb4_unicode_ci,
  `notas` text COLLATE utf8mb4_unicode_ci,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `taller_registros` (
  `id` int NOT NULL AUTO_INCREMENT,
  `maquina_id` int NOT NULL,
  `tipo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mantenimiento',
  `fecha` date NOT NULL,
  `descripcion` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `costo` decimal(12,2) DEFAULT NULL,
  `responsable` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tr_maquina` (`maquina_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tipos_cliente` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rol` enum('admin','vendedor','repartidor') COLLATE utf8mb4_unicode_ci DEFAULT 'vendedor',
  `telefono` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `permisos` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `venta_asignaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pedido_id` int NOT NULL,
  `detalle_id` int DEFAULT NULL,
  `producto_id` int NOT NULL,
  `proveedor_id` int NOT NULL DEFAULT '0',
  `cantidad` int NOT NULL,
  `costo_unit` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `lote_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_va_pedido` (`pedido_id`),
  KEY `idx_va_prod` (`producto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;