ARG WAR_BASENAME=opendolphin-server
ARG MVN_PROFILES=dev

FROM maven:3.9.6-eclipse-temurin-17 AS build
ARG WAR_BASENAME
ARG MVN_PROFILES
WORKDIR /workspace

COPY pom.xml ./
COPY pom.server-modernized.xml ./pom.server-modernized.xml
COPY domain ./domain
COPY api-contract ./api-contract
COPY persistence ./persistence
COPY reporting ./reporting
COPY server-modernized ./server-modernized
COPY ext_lib ./ext_lib
COPY ops/shared/docker/settings.xml /tmp/maven-settings.xml

RUN mvn -N -f pom.server-modernized.xml -s /tmp/maven-settings.xml -B install:install-file -Dfile=ext_lib/iTextAsian.jar -DgroupId=opendolphin -DartifactId=itext-font -Dversion=1.0 -Dpackaging=jar
RUN mvn -N -f pom.server-modernized.xml -s /tmp/maven-settings.xml -B install:install-file -Dfile=ext_lib/AppleJavaExtensions.jar -DgroupId=com.apple -DartifactId=AppleJavaExtensions -Dversion=1.6 -Dpackaging=jar
RUN mvn -N -f pom.server-modernized.xml -s /tmp/maven-settings.xml -B dependency:get -Dartifact=org.postgresql:postgresql:42.7.3
RUN mvn -N -f pom.server-modernized.xml -s /tmp/maven-settings.xml -B dependency:get -Dartifact=org.hibernate:hibernate-core:5.0.10.Final

RUN mkdir -p /tmp/hbcompat/src/org/hibernate/type /tmp/hbcompat/classes
COPY ops/modernized-server/docker/hbcompat/StringClobType.java /tmp/hbcompat/src/org/hibernate/type/StringClobType.java

RUN javac -cp /root/.m2/repository/org/hibernate/hibernate-core/5.0.10.Final/hibernate-core-5.0.10.Final.jar -d /tmp/hbcompat/classes /tmp/hbcompat/src/org/hibernate/type/StringClobType.java
RUN jar cf /tmp/hbcompat/string-clob-type-compat.jar -C /tmp/hbcompat/classes .

RUN set -eux; \
    mvn -f pom.server-modernized.xml -s /tmp/maven-settings.xml -B -pl server-modernized -am -P ${MVN_PROFILES} -DskipTests package; \
    WAR_DIR=server-modernized/target; \
    WAR_FILE="${WAR_DIR}/${WAR_BASENAME}.war"; \
    if [ ! -f "${WAR_FILE}" ]; then \
        FIRST_WAR=$(ls "${WAR_DIR}"/*.war | head -n 1); \
        mv "${FIRST_WAR}" "${WAR_FILE}"; \
    fi

FROM quay.io/wildfly/wildfly:33.0.2.Final-jdk17
ARG WAR_BASENAME
ENV JBOSS_HOME=/opt/jboss/wildfly \
    WILDFLY_HOME=/opt/jboss/wildfly

USER root
RUN mkdir -p /usr/share/fonts/opendolphin
COPY ops/assets/fonts/NotoSansCJKjp-Regular.otf /usr/share/fonts/opendolphin/NotoSansCJKjp-Regular.otf
RUN chmod 644 /usr/share/fonts/opendolphin/NotoSansCJKjp-Regular.otf
ENV OPENDOLPHIN_REPORT_FONT_PATH=/usr/share/fonts/opendolphin/NotoSansCJKjp-Regular.otf
COPY --from=build /workspace/server-modernized/target/${WAR_BASENAME}.war ${WILDFLY_HOME}/standalone/deployments/${WAR_BASENAME}.war
COPY --from=build /root/.m2/repository/org/postgresql/postgresql/*/postgresql-*.jar /opt/jboss/postgresql-driver.jar
COPY --from=build /tmp/hbcompat/string-clob-type-compat.jar /opt/jboss/string-clob-type-compat.jar
RUN mkdir -p ${WILDFLY_HOME}/modules/system/layers/base/org/postgresql/main && \
    cp /opt/jboss/postgresql-driver.jar ${WILDFLY_HOME}/modules/system/layers/base/org/postgresql/main/postgresql-driver.jar
COPY ops/modernized-server/docker/modules/postgresql/module.xml ${WILDFLY_HOME}/modules/system/layers/base/org/postgresql/main/module.xml
RUN mkdir -p /opt/jboss/config
COPY server-modernized/config/attachment-storage.sample.yaml /opt/jboss/config/attachment-storage.yaml
COPY ops/shared/docker/custom.properties ${WILDFLY_HOME}/custom.properties
COPY ops/modernized-server/docker/configure-wildfly.cli /opt/jboss/configure-wildfly.cli
COPY ops/modernized-server/docker/healthcheck-session.sh /opt/jboss/healthcheck-session.sh
COPY ops/shared/docker/bootstrap.sh /opt/jboss/bootstrap.sh
RUN chmod +x /opt/jboss/bootstrap.sh /opt/jboss/healthcheck-session.sh

RUN mkdir -p ${WILDFLY_HOME}/modules/system/layers/base/io/agroal/api/main
COPY ops/modernized-server/docker/modules/io/agroal/api/module.xml ${WILDFLY_HOME}/modules/system/layers/base/io/agroal/api/main/module.xml

RUN mkdir -p /opt/jboss/tmp/WEB-INF/lib && \
    mv /opt/jboss/string-clob-type-compat.jar /opt/jboss/tmp/WEB-INF/lib/ && \
    cd /opt/jboss/tmp && \
    jar uf ${WILDFLY_HOME}/standalone/deployments/${WAR_BASENAME}.war -C /opt/jboss/tmp WEB-INF && \
    rm -rf /opt/jboss/tmp

RUN HIBERNATE_MODULE=${WILDFLY_HOME}/modules/system/layers/base/org/hibernate/main/module.xml && \
    if ! grep -q 'name="org.postgresql"' "${HIBERNATE_MODULE}"; then \
        sed -i '/<\/dependencies>/ i\\        <module name="org.postgresql"/>' "${HIBERNATE_MODULE}"; \
    fi

# Manual check (Ops-CLI): run `docker build -f ops/modernized-server/docker/Dockerfile .` and ensure the JBoss CLI log shows configure-wildfly.cli finishing with `outcome => success`
RUN ${WILDFLY_HOME}/bin/jboss-cli.sh --file=/opt/jboss/configure-wildfly.cli && \
    rm -f /opt/jboss/configure-wildfly.cli && \
    rm -rf ${WILDFLY_HOME}/standalone/configuration/standalone_xml_history

RUN chown -R jboss:0 ${WILDFLY_HOME} /opt/jboss/bootstrap.sh /opt/jboss/healthcheck-session.sh /opt/jboss/postgresql-driver.jar

EXPOSE 8080 9990

USER jboss
ENTRYPOINT ["/opt/jboss/bootstrap.sh"]
CMD ["/opt/jboss/wildfly/bin/standalone.sh", "-c", "standalone-full.xml", "-b", "0.0.0.0", "-bmanagement", "0.0.0.0"]
